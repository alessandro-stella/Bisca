require("dotenv").config();

const db = require("../db");

function getPlayerKBase(matchesPlayed, elo) {
  if (matchesPlayed < 15) {
    return 40;
  }

  if (matchesPlayed < 30) {
    return 30;
  }

  if (matchesPlayed < 50) {
    return 20;
  }

  if (elo > 1700) {
    return 15;
  }

  return 20;
}

function getTableFactor(totalPlayers) {
  const tableWeights = {
    2: 0.75,
    3: 0.9,
    4: 1.0,
    5: 1.15,
    6: 1.3,
  };

  return tableWeights[totalPlayers] || 1.0;
}

function getExpectedScore(playerElo, opponentElo) {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

function getAverageExpectedScore(player, opponents) {
  if (opponents.length === 0) {
    return 0.5;
  }

  const totalExpected = opponents.reduce((sum, opponent) => {
    return sum + getExpectedScore(player.elo, opponent.elo);
  }, 0);

  return totalExpected / opponents.length;
}

function getActualScore(position, totalPlayers) {
  if (totalPlayers <= 1) {
    return 1.0;
  }

  return (totalPlayers - position) / (totalPlayers - 1);
}

async function getPlayersEloData(client, playerIds) {
  const result = await client.query(
    `
      SELECT
        u.id,
        u.elo,
        COUNT(gp.user_id)::integer AS matches_played
      FROM users u
      LEFT JOIN game_players gp
        ON gp.user_id = u.id
      WHERE u.id = ANY($1)
      GROUP BY u.id, u.elo
  `,
    [playerIds],
  );

  return new Map(
    result.rows.map((row) => [
      row.id,
      {
        elo: Number(row.elo),
        matchesPlayed: Number(row.matches_played),
      },
    ]),
  );
}

function calculateEloChanges(players, eloData) {
  const totalPlayers = players.length;

  return players.map((player) => {
    const playerData = eloData.get(player.id);

    if (!playerData) {
      throw new Error(`ELO data not found for player ${player.id}`);
    }

    const playerElo = playerData.elo;

    const opponents = players
      .filter((p) => p.id !== player.id)
      .map((p) => {
        const opponentData = eloData.get(p.id);

        if (!opponentData) {
          throw new Error(`ELO data not found for player ${p.id}`);
        }

        return {
          id: p.id,
          elo: opponentData.elo,
        };
      });

    const expectedScore = getAverageExpectedScore(
      {
        id: player.id,
        elo: playerElo,
      },
      opponents,
    );

    const actualScore = getActualScore(player.position, totalPlayers);

    const kBase = getPlayerKBase(playerData.matchesPlayed, playerElo);

    const tableFactor = getTableFactor(totalPlayers);

    const kFactor = Math.round(kBase * tableFactor);

    const eloChange = Math.round(kFactor * (actualScore - expectedScore));

    const newElo = Math.max(100, playerElo + eloChange);

    return {
      id: player.id,
      position: player.position,
      oldElo: playerElo,
      newElo,
      change: eloChange,
      expectedScore,
      actualScore,
      kFactor,
    };
  });
}

async function calculateAndUpdateElo(gameId, players) {
  if (!gameId) {
    throw new Error("gameId is required");
  }

  if (!Array.isArray(players) || players.length === 0) {
    throw new Error("players must be a non-empty array");
  }

  const positions = players.map((player) => player.position);

  const uniquePositions = new Set(positions);

  if (uniquePositions.size !== positions.length) {
    throw new Error("Player positions must be unique");
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const playerIds = players.map((player) => player.id);

    const eloData = await getPlayersEloData(client, playerIds);

    const evaluatedPlayers = calculateEloChanges(players, eloData);

    for (const player of evaluatedPlayers) {
      await client.query(
        `
          UPDATE users
          SET elo = $1
          WHERE id = $2
        `,
        [player.newElo, player.id],
      );

      await client.query(
        `
          INSERT INTO elo_history (
            game_id,
            user_id,
            old_elo,
            elo_change,
            new_elo,
            position
          )
          VALUES (
            $1, $2, $3, $4, $5, $6
          )
        `,
        [
          gameId,
          player.id,
          player.oldElo,
          player.change,
          player.newElo,
          player.position,
        ],
      );
    }

    await client.query("COMMIT");

    return evaluatedPlayers;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  calculateAndUpdateElo,
  calculateEloChanges,
  getExpectedScore,
  getActualScore,
};
