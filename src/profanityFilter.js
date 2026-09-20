const fs = require("fs");
const path = require("path");
const levenshtein = require("fast-levenshtein");

let badWords = {
  italian: [],
  english: [],
};

let similarityThreshold = 80;

function loadProfanityList() {
  try {
    const filePath = path.join(__dirname, "../profanity-list.json");
    const data = fs.readFileSync(filePath, "utf-8");
    badWords = JSON.parse(data);
    console.log(
      `Loaded ${badWords.italian.length} italian terms and ${badWords.english.length} english terms`,
    );
  } catch (error) {
    console.error("Error while loading profanity-list.json:", error.message);
    badWords = { italian: [], english: [] };
  }
}

const leetMap = {
  0: "o",
  1: "i",
  3: "e",
  4: "a",
  5: "s",
  7: "t",
  8: "b",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "l",
};

function normalizeLeet(testo) {
  return testo
    .toLowerCase()
    .split("")
    .map((char) => leetMap[char] || char)
    .join("");
}

function similarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  const distance = levenshtein.get(str1, str2);
  return ((maxLen - distance) / maxLen) * 100;
}

function isProfane(testo, customThreshold = null) {
  const threshold =
    customThreshold !== null ? customThreshold : similarityThreshold;
  const normalized = normalizeLeet(testo);
  const words = normalized.split(/\s+/);

  const allBadWords = [...badWords.italian, ...badWords.english];

  for (let badWord of allBadWords) {
    if (badWord.length > 2) {
      if (normalized.includes(badWord)) {
        return true;
      }

      for (let userWord of words) {
        if (similarity(userWord, badWord) >= threshold) {
          return true;
        }
      }
    }
  }

  return false;
}

function setThreshold(threshold) {
  similarityThreshold = threshold;
  console.log(`Similarity threshold set to ${threshold}%`);
}

function getThreshold() {
  return similarityThreshold;
}

loadProfanityList();

module.exports = {
  isProfane,
  reloadList: loadProfanityList,
  setThreshold,
  getThreshold,
};
