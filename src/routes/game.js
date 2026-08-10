const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

const db = require("../db");

router.post("/fetch", async (req, res) => {
  const { userId } = req.body;
  console.log({ userId });

  return res.sendStatus(200);
});

router.post("/save", async (req, res) => {
  const { game } = req.body;
  console.log({ game });

  return res.sendStatus(200);
});

module.exports = router;
