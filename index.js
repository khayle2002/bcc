require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Folder structure:
// index.js
// config/
//   prices.json
const configPath = path.join(__dirname, "config", "prices.json");

// ===============================
// CONFIG
// ===============================

function loadConfig() {
  return JSON.parse(
    fs.readFileSync(configPath, "utf8")
  );
}

function saveConfig(config) {
  fs.writeFileSync(
    configPath,
    JSON.stringify(config, null, 2)
  );
}

function money(value) {
  const config = loadConfig();

  return `${config.currency}${Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`;
}

// ===============================
// AGENTS
// ===============================

const AGENT_PRICE = 100;

const agents = [
  "Jett",
  "Phoenix",
  "Raze",
  "Reyna",
  "Yoru",
  "Neon",
  "Iso",
  "Waylay",
  "Astra",
  "Brimstone",
  "Clove",
  "Harbor",
  "Omen",
  "Viper",
  "Miks",
  "Breach",
  "Fade",
  "Gekko",
  "KAY/O",
  "Skye",
  "Sova",
  "Tejo",
  "Chamber,Cham",
  "Cypher",
  "Deadlock",
  "Killjoy,KJ",
  "Sage",
  "Vyse",
  "Brimstone,Brim",
  "Veto"
];

function normalizeAgent(agent) {
  return String(agent)
    .trim()
    .toLowerCase();
}

// ===============================
// RANKS
// ===============================

const rankChoices = [
  ["Iron 1", "iron1"],
  ["Iron 2", "iron2"],
  ["Iron 3", "iron3"],

  ["Bronze 1", "bronze1"],
  ["Bronze 2", "bronze2"],
  ["Bronze 3", "bronze3"],

  ["Silver 1", "silver1"],
  ["Silver 2", "silver2"],
  ["Silver 3", "silver3"],

  ["Gold 1", "gold1"],
  ["Gold 2", "gold2"],
  ["Gold 3", "gold3"],

  ["Platinum 1", "platinum1"],
  ["Platinum 2", "platinum2"],
  ["Platinum 3", "platinum3"],

  ["Diamond 1", "diamond1"],
  ["Diamond 2", "diamond2"],
  ["Diamond 3", "diamond3"],

  ["Ascendant 1", "ascendant1"],
  ["Ascendant 2", "ascendant2"],
  ["Ascendant 3", "ascendant3"],

  ["Immortal 1", "immortal1"],
  ["Immortal 2", "immortal2"],
  ["Immortal 3", "immortal3"],

  ["Radiant", "radiant"]
];

const rankOrder = rankChoices.map(
  x => x[1]
);

function addRankChoices(option) {
  for (const [name, value] of rankChoices) {
    option.addChoices({
      name,
      value
    });
  }

  return option;
}

// ===============================
// EMBEDS
// ===============================

function errorEmbed(text) {
  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle("❌ Calculator Error")
    .setDescription(text);
}

function resultEmbed(title, fields) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(title)
    .setTimestamp();

  for (const field of fields) {
    embed.addFields({
      name: field.name,
      value: String(field.value),
      inline: field.inline ?? false
    });
  }

  return embed;
}

// ===============================
// RANK CALCULATOR
// ===============================

function calculateRankBoost(current, target) {
  const config = loadConfig();

  const currentIndex =
    rankOrder.indexOf(current);

  const targetIndex =
    rankOrder.indexOf(target);

  if (
    currentIndex < 0 ||
    targetIndex < 0
  ) {
    throw new Error(
      "Invalid rank."
    );
  }

  if (target === "radiant") {
    return {
      radiant: true,
      message: config.radiant.note
    };
  }

  if (targetIndex <= currentIndex) {
    throw new Error(
      "The target rank must be higher than the current rank."
    );
  }

  let total = 0;
  const steps = [];

  for (
    let i = currentIndex + 1;
    i <= targetIndex;
    i++
  ) {
    const rank = rankOrder[i];
    const price = config.ranks[rank];

    if (
      typeof price !== "number"
    ) {
      throw new Error(
        `Missing price for rank: ${rank}`
      );
    }

    total += price;

    const display =
      rankChoices.find(
        x => x[1] === rank
      )[0];

    steps.push(
      `${display} — ${money(price)}`
    );
  }

  return {
    radiant: false,
    total,
    steps
  };
}

// ===============================
// SLASH COMMANDS
// ===============================

const commands = [

  // /calc
  new SlashCommandBuilder()
    .setName("calc")
    .setDescription(
      "Calculate a basic arithmetic expression."
    )
    .addStringOption(o =>
      o
        .setName("expression")
        .setDescription(
          "Example: 1500 + 750 + 100"
        )
        .setRequired(true)
    ),

  // /boost
  new SlashCommandBuilder()
    .setName("boost")
    .setDescription(
      "Calculate a BARCODE Valorant boosting order."
    )

    .addStringOption(o =>
      addRankChoices(
        o
          .setName("current")
          .setDescription(
            "Current rank"
          )
          .setRequired(true)
      )
    )

    .addStringOption(o =>
      addRankChoices(
        o
          .setName("target")
          .setDescription(
            "Target rank"
          )
          .setRequired(true)
      )
    )

    .addBooleanOption(o =>
      o
        .setName("rush")
        .setDescription(
          "Rush/Priority Boost: +50%"
        )
    )

    .addBooleanOption(o =>
      o
        .setName("party")
        .setDescription(
          "Party Boost: x2.5"
        )
    )

    .addStringOption(o =>
      o
        .setName("agents")
        .setDescription(
          "Agents separated by commas. Example: Jett, Raze"
        )
    )

    .addIntegerOption(o =>
      o
        .setName("levels")
        .setDescription(
          "Level Boost: +₱150 per level"
        )
        .setMinValue(0)
        .setMaxValue(100)
    ),

  // /price
  new SlashCommandBuilder()
    .setName("price")
    .setDescription(
      "Check the price for reaching a rank."
    )
    .addStringOption(o =>
      addRankChoices(
        o
          .setName("rank")
          .setDescription("Rank")
          .setRequired(true)
      )
    ),

  // /prices
  new SlashCommandBuilder()
    .setName("prices")
    .setDescription(
      "Show the complete BARCODE price list."
    ),

  // /fees
  new SlashCommandBuilder()
    .setName("fees")
    .setDescription(
      "Show current BARCODE add-on fees."
    ),

  // /setprice
  new SlashCommandBuilder()
    .setName("setprice")
    .setDescription(
      "Admin: change a rank price."
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild.toString()
    )
    .addStringOption(o =>
      addRankChoices(
        o
          .setName("rank")
          .setDescription("Rank")
          .setRequired(true)
      )
    )
    .addIntegerOption(o =>
      o
        .setName("amount")
        .setDescription("New price")
        .setRequired(true)
        .setMinValue(0)
    ),

  // /setfee
  new SlashCommandBuilder()
    .setName("setfee")
    .setDescription(
      "Admin: change an add-on fee."
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild.toString()
    )
    .addStringOption(o =>
      o
        .setName("fee")
        .setDescription("Fee")
        .setRequired(true)
        .addChoices(
          {
            name: "Rush percentage",
            value: "rush_percent"
          },
          {
            name: "Party multiplier",
            value: "party_multiplier"
          },
          {
            name: "Agent/Role request",
            value: "agent_request"
          },
          {
            name: "Level per level",
            value: "level_per_level"
          }
        )
    )
    .addNumberOption(o =>
      o
        .setName("amount")
        .setDescription(
          "New value"
        )
        .setRequired(true)
        .setMinValue(0)
    ),

  // /help
  new SlashCommandBuilder()
    .setName("help")
    .setDescription(
      "Show calculator commands."
    )

].map(
  c => c.toJSON()
);

// ===============================
// REGISTER COMMANDS
// ===============================

async function registerCommands() {

  const rest = new REST({
    version: "10"
  }).setToken(
    process.env.DISCORD_TOKEN
  );

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    {
      body: commands
    }
  );

  console.log(
    "Slash commands registered."
  );
}

// ===============================
// READY
// ===============================

client.once(
  "ready",
  async () => {

    console.log(
      `Logged in as ${client.user.tag}`
    );

    try {

      await registerCommands();

    } catch (err) {

      console.error(
        "Command registration failed:",
        err
      );

    }

  }
);

// ===============================
// INTERACTIONS
// ===============================

client.on(
  "interactionCreate",
  async interaction => {

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }

    try {

      const config =
        loadConfig();

      // ==========================
      // /CALC
      // ==========================

      if (
        interaction.commandName ===
        "calc"
      ) {

        const expression =
          interaction.options.getString(
            "expression"
          );

        if (
          !/^[0-9+\-*/().%\s]+$/.test(
            expression
          )
        ) {

          return interaction.reply({
            embeds: [
              errorEmbed(
                "Only numbers and +, -, *, /, %, and parentheses are allowed."
              )
            ],
            ephemeral: true
          });

        }

        let result;

        try {

          result =
            Function(
              `"use strict"; return (${expression})`
            )();

        } catch {

          return interaction.reply({
            embeds: [
              errorEmbed(
                "That expression could not be calculated."
              )
            ],
            ephemeral: true
          });

        }

        if (
          !Number.isFinite(result)
        ) {

          return interaction.reply({
            embeds: [
              errorEmbed(
                "The result is not a valid number."
              )
            ],
            ephemeral: true
          });

        }

        return interaction.reply({

          embeds: [
            resultEmbed(
              "🧮 Calculator",
              [
                {
                  name: "Expression",
                  value:
                    `\`${expression}\``
                },
                {
                  name: "Result",
                  value:
                    `**${result}**`
                }
              ]
            )
          ]

        });

      }

      // ==========================
      // /PRICE
      // ==========================

      if (
        interaction.commandName ===
        "price"
      ) {

        const rank =
          interaction.options.getString(
            "rank"
          );

        if (
          rank === "radiant"
        ) {

          return interaction.reply({

            embeds: [
              resultEmbed(
                "⭐ Radiant",
                [
                  {
                    name: "Price",
                    value:
                      "**Negotiable / Price may vary**"
                  },
                  {
                    name: "Contact",
                    value:
                      "Send BARCODE a PM for a quote."
                  }
                ]
              )
            ]

          });

        }

        return interaction.reply({

          embeds: [
            resultEmbed(
              "🎮 BARCODE Rank Price",
              [
                {
                  name: "Rank",
                  value:
                    rankChoices.find(
                      x =>
                        x[1] === rank
                    )[0],
                  inline: true
                },
                {
                  name: "Price",
                  value:
                    money(
                      config.ranks[rank]
                    ),
                  inline: true
                }
              ]
            )
          ]

        });

      }

      // ==========================
      // /PRICES
      // ==========================

      if (
        interaction.commandName ===
        "prices"
      ) {

        const lines =
          rankChoices
            .filter(
              x =>
                x[1] !== "radiant"
            )
            .map(
              x =>
                `**${x[0]}** — ${money(
                  config.ranks[x[1]]
                )}`
            );

        const embed =
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(
              "🎮 BARCODE VALORANT BOOSTING PRICE LIST"
            )
            .setDescription(
              lines.join("\n") +
              "\n\n**Radiant** — Negotiable / Price may vary"
            )
            .setFooter({
              text:
                "Prices may vary. Send BARCODE a PM for a quote."
            });

        return interaction.reply({
          embeds: [embed]
        });

      }

      // ==========================
      // /FEES
      // ==========================

      if (
        interaction.commandName ===
        "fees"
      ) {

        const f =
          config.fees;

        return interaction.reply({

          embeds: [
            resultEmbed(
              "⚡ BARCODE EXTRA SERVICES & ADD-ONS",
              [
                {
                  name:
                    "Rush/Priority Boost",
                  value:
                    `+${f.rush_percent}% of total price`
                },
                {
                  name:
                    "Party Boost",
                  value:
                    `x${f.party_multiplier} of total price`
                },
                {
                  name:
                    "Agent Request",
                  value:
                    `+${money(
                      AGENT_PRICE
                    )} per agent`
                },
                {
                  name:
                    "Level Boost",
                  value:
                    `+${money(
                      f.level_per_level
                    )} per level`
                }
              ]
            )
          ]

        });

      }

      // ==========================
      // /BOOST
      // ==========================

      if (
        interaction.commandName ===
        "boost"
      ) {

        const current =
          interaction.options.getString(
            "current"
          );

        const target =
          interaction.options.getString(
            "target"
          );

        const rush =
          interaction.options.getBoolean(
            "rush"
          ) ?? false;

        const party =
          interaction.options.getBoolean(
            "party"
          ) ?? false;

        const agentInput =
          interaction.options.getString(
            "agents"
          ) ?? "";

        const levels =
          interaction.options.getInteger(
            "levels"
          ) ?? 0;

        // --------------------------
        // RANK CALCULATION
        // --------------------------

        let calculation;

        try {

          calculation =
            calculateRankBoost(
              current,
              target
            );

        } catch (e) {

          return interaction.reply({

            embeds: [
              errorEmbed(
                e.message
              )
            ],

            ephemeral: true

          });

        }

        // --------------------------
        // RADIANT
        // --------------------------

        if (
          calculation.radiant
        ) {

          return interaction.reply({

            embeds: [
              resultEmbed(
                "⭐ Radiant Boost",
                [
                  {
                    name:
                      "Current Rank",
                    value:
                      rankChoices.find(
                        x =>
                          x[1] === current
                      )[0]
                  },
                  {
                    name:
                      "Target Rank",
                    value:
                      "Radiant"
                  },
                  {
                    name:
                      "Price",
                    value:
                      "**Negotiable / Price may vary**"
                  },
                  {
                    name:
                      "Next Step",
                    value:
                      "Send BARCODE a PM for a custom quote."
                  }
                ]
              )
            ]

          });

        }

        // --------------------------
        // BASE PRICE
        // --------------------------

        let subtotal =
          calculation.total;

        const additions = [];

        // --------------------------
        // AGENT REQUEST
        // --------------------------

        let selectedAgents = [];

        if (
          agentInput.trim()
        ) {

          selectedAgents =
            agentInput
              .split(",")
              .map(
                a => a.trim()
              )
              .filter(Boolean);

          // Remove duplicates
          selectedAgents =
            [
              ...new Map(
                selectedAgents.map(
                  agent => [
                    normalizeAgent(
                      agent
                    ),
                    agent
                  ]
                )
              ).values()
            ];

          // Find invalid agents
          const invalidAgents =
            selectedAgents.filter(
              input =>
                !agents.some(
                  agent =>
                    normalizeAgent(
                      agent
                    ) ===
                    normalizeAgent(
                      input
                    )
                )
            );

          if (
            invalidAgents.length > 0
          ) {

            return interaction.reply({

              embeds: [
                errorEmbed(
                  `Invalid agent(s): **${invalidAgents.join(
                    ", "
                  )}**\n\nPlease use valid Valorant agent names.`
                )
              ],

              ephemeral: true

            });

          }

          // ₱100 PER AGENT
          const agentFee =
            selectedAgents.length *
            AGENT_PRICE;

          subtotal +=
            agentFee;

          additions.push(
            `🎯 Agent Request (${selectedAgents.join(
              ", "
            )}): +${money(
              agentFee
            )}`
          );

        }

        // --------------------------
        // LEVEL BOOST
        // --------------------------

        if (
          levels > 0
        ) {

          const levelFee =
            levels *
            config.fees
              .level_per_level;

          subtotal +=
            levelFee;

          additions.push(
            `📈 Level Boost (${levels}): +${money(
              levelFee
            )}`
          );

        }

        // --------------------------
        // PARTY BOOST
        // --------------------------

        if (
          party
        ) {

          subtotal *=
            config.fees
              .party_multiplier;

          additions.push(
            `🤝 Party Boost: x${config.fees.party_multiplier}`
          );

        }

        // --------------------------
        // RUSH
        // --------------------------

        if (
          rush
        ) {

          const rushFee =
            subtotal *
            (
              config.fees
                .rush_percent / 100
            );

          subtotal +=
            rushFee;

          additions.push(
            `⚡ Rush/Priority: +${money(
              rushFee
            )}`
          );

        }

        // --------------------------
        // AGENT DISPLAY
        // --------------------------

        const agentDisplay =
          selectedAgents.length > 0
            ? selectedAgents.join(
                ", "
              )
            : "None";

        // --------------------------
        // RESULT
        // --------------------------

        return interaction.reply({

          embeds: [

            resultEmbed(
              "🎮 BARCODE BOOST CALCULATOR",
              [

                {
                  name:
                    "Current Rank",
                  value:
                    rankChoices.find(
                      x =>
                        x[1] === current
                    )[0],
                  inline: true
                },

                {
                  name:
                    "Target Rank",
                  value:
                    rankChoices.find(
                      x =>
                        x[1] === target
                    )[0],
                  inline: true
                },

                {
                  name:
                    "Rank Progression",
                  value:
                    calculation.steps.join(
                      "\n"
                    )
                },

                {
                  name:
                    "Base Boost Price",
                  value:
                    money(
                      calculation.total
                    )
                },

                {
                  name:
                    "🎯 Agent Request",
                  value:
                    agentDisplay
                },

                {
                  name:
                    "Add-ons",
                  value:
                    additions.length > 0
                      ? additions.join(
                          "\n"
                        )
                      : "None"
                },

                {
                  name:
                    "💰 TOTAL",
                  value:
                    `# **${money(
                      subtotal
                    )}**`
                }

              ]
            )

          ]

        });

      }

      // ==========================
      // /SETPRICE
      // ==========================

      if (
        interaction.commandName ===
        "setprice"
      ) {

        const rank =
          interaction.options.getString(
            "rank"
          );

        if (
          rank === "radiant"
        ) {

          return interaction.reply({

            embeds: [
              errorEmbed(
                "Radiant is negotiable and does not use a fixed price."
              )
            ],

            ephemeral: true

          });

        }

        const amount =
          interaction.options.getInteger(
            "amount"
          );

        config.ranks[rank] =
          amount;

        saveConfig(config);

        return interaction.reply({

          embeds: [
            resultEmbed(
              "✅ Price Updated",
              [
                {
                  name:
                    "Rank",
                  value:
                    rankChoices.find(
                      x =>
                        x[1] === rank
                    )[0]
                },
                {
                  name:
                    "New Price",
                  value:
                    money(amount)
                }
              ]
            )
          ]

        });

      }

      // ==========================
      // /SETFEE
      // ==========================

      if (
        interaction.commandName ===
        "setfee"
      ) {

        const fee =
          interaction.options.getString(
            "fee"
          );

        const amount =
          interaction.options.getNumber(
            "amount"
          );

        config.fees[fee] =
          amount;

        saveConfig(config);

        return interaction.reply({

          embeds: [
            resultEmbed(
              "✅ Fee Updated",
              [
                {
                  name:
                    "Fee",
                  value:
                    fee
                },
                {
                  name:
                    "New Value",
                  value:
                    String(amount)
                }
              ]
            )
          ]

        });

      }

      // ==========================
      // /HELP
      // ==========================

      if (
        interaction.commandName ===
        "help"
      ) {

        return interaction.reply({

          embeds: [
            resultEmbed(
              "🤖 BARCODE CALCULATOR BOT",
              [
                {
                  name:
                    "/calc",
                  value:
                    "Basic arithmetic calculator."
                },
                {
                  name:
                    "/boost",
                  value:
                    "Calculate current rank → target rank."
                },
                {
                  name:
                    "🎯 Agent Request",
                  value:
                    "Enter agents separated by commas. Each agent costs ₱100."
                },
                {
                  name:
                    "/price",
                  value:
                    "Check one rank's price."
                },
                {
                  name:
                    "/prices",
                  value:
                    "Show the complete price list."
                },
                {
                  name:
                    "/fees",
                  value:
                    "Show Rush, Party, Agent and Level Boost fees."
                },
                {
                  name:
                    "/setprice",
                  value:
                    "Admin-only: update a rank price."
                },
                {
                  name:
                    "/setfee",
                  value:
                    "Admin-only: update a service fee."
                }
              ]
            )
          ]

        });

      }

    } catch (err) {

      console.error(
        err
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {

        await interaction.reply({

          embeds: [
            errorEmbed(
              "Something went wrong while processing that command."
            )
          ],

          ephemeral: true

        });

      }

    }

  }
);

// ===============================
// ENVIRONMENT VARIABLES
// ===============================

if (
  !process.env.DISCORD_TOKEN ||
  !process.env.CLIENT_ID ||
  !process.env.GUILD_ID
) {

  console.error(
    "Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in .env"
  );

  process.exit(1);

}

// ===============================
// LOGIN
// ===============================

client.login(
  process.env.DISCORD_TOKEN
);
