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
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// =====================================================
// FILE CONFIG
// =====================================================

const configPath = path.join(
  __dirname,
  "config",
  "prices.json"
);

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

  return `${config.currency}${Number(value).toLocaleString(
    "en-PH",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  )}`;
}

// =====================================================
// AGENTS
// =====================================================

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
  "Chamber",
  "Cypher",
  "Deadlock",
  "Killjoy",
  "Sage",
  "Vyse",
  "Veto"
];

function normalizeAgent(agent) {
  return String(agent)
    .trim()
    .toLowerCase();
}

const uniqueAgents = [
  ...new Map(
    agents.map(agent => [
      normalizeAgent(agent),
      agent
    ])
  ).values()
];

// =====================================================
// RANKS
// =====================================================

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

function rankName(value) {
  const found = rankChoices.find(
    x => x[1] === value
  );

  return found ? found[0] : value;
}

// =====================================================
// EMBEDS
// =====================================================

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

// =====================================================
// RANK CALCULATOR
// =====================================================

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
    throw new Error("Invalid rank.");
  }

  if (target === "radiant") {
    return {
      radiant: true,
      message: config.radiant?.note || ""
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

    if (typeof price !== "number") {
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

// =====================================================
// CALCULATOR SESSIONS
// =====================================================

const calculatorSessions = new Map();

function createEmptySession() {
  return {
    current: null,
    target: null,
    rush: false,
    party: false,
    agents: [],
    levels: 0,
    agentPage: 0
  };
}

function getSession(userId) {
  if (!calculatorSessions.has(userId)) {
    calculatorSessions.set(
      userId,
      createEmptySession()
    );
  }

  return calculatorSessions.get(userId);
}

function resetSession(userId) {
  const session = createEmptySession();

  calculatorSessions.set(
    userId,
    session
  );

  return session;
}

// =====================================================
// CALCULATOR PANEL
// =====================================================

function calculatorPanelEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("🧮 BARCODE BOOST CALCULATOR")
    .setDescription(
      [
        "Want to know how much your Valorant boost will cost?",
        "",
        "Use our calculator to get an estimated price instantly.",
        "",
        "🎮 **Current Rank** — Select from dropdown",
        "🏆 **Desired Rank** — Select from dropdown",
        "⚡ **Rush / Priority** — Click to toggle",
        "🤝 **Party Boost** — Click to toggle",
        "🎯 **Agent Request** — Select your agents",
        "📈 **Level Boost** — Use + / − buttons",
        "",
        "💰 Click **Calculate Price** when finished.",
        "",
        "**Everything can be selected by clicking.**"
      ].join("\n")
    )
    .setFooter({
      text: "BARCODE Valorant Boosting Services"
    });
}

function calculatorPanelComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("calculator_start")
        .setLabel("Calculate Your Price")
        .setEmoji("🧮")
        .setStyle(ButtonStyle.Primary)
    )
  ];
}

// =====================================================
// CURRENT RANK MENU
// =====================================================

function currentRankMenu(session) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("calc_current_rank")
      .setPlaceholder(
        session.current
          ? `Current: ${rankName(session.current)}`
          : "🎮 Select Current Rank"
      )
      .addOptions(
        rankChoices.map(
          ([name, value]) => ({
            label: name,
            value,
            default:
              session.current === value
          })
        )
      )
  );
}

// =====================================================
// TARGET RANK MENU
// =====================================================

function targetRankMenu(session) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("calc_target_rank")
      .setPlaceholder(
        session.target
          ? `Desired: ${rankName(session.target)}`
          : "🏆 Select Desired Rank"
      )
      .addOptions(
        rankChoices.map(
          ([name, value]) => ({
            label: name,
            value,
            default:
              session.target === value
          })
        )
      )
  );
}

// =====================================================
// SERVICE BUTTONS
// =====================================================

function serviceButtons(session) {
  return new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId("calc_rush")
      .setLabel(
        session.rush
          ? "Rush: ON"
          : "Rush: OFF"
      )
      .setEmoji("⚡")
      .setStyle(
        session.rush
          ? ButtonStyle.Success
          : ButtonStyle.Secondary
      ),

    new ButtonBuilder()
      .setCustomId("calc_party")
      .setLabel(
        session.party
          ? "Party: ON"
          : "Party: OFF"
      )
      .setEmoji("🤝")
      .setStyle(
        session.party
          ? ButtonStyle.Success
          : ButtonStyle.Secondary
      ),

    new ButtonBuilder()
      .setCustomId("calc_level_down")
      .setLabel("−")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(session.levels <= 0),

    new ButtonBuilder()
      .setCustomId("calc_level_display")
      .setLabel(
        `Level: ${session.levels}`
      )
      .setEmoji("📈")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),

    new ButtonBuilder()
      .setCustomId("calc_level_up")
      .setLabel("+")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(session.levels >= 20)

  );
}

// =====================================================
// AGENT PAGES
// =====================================================

function getAgentPages() {
  const pages = [];

  for (
    let i = 0;
    i < uniqueAgents.length;
    i += 25
  ) {
    pages.push(
      uniqueAgents.slice(i, i + 25)
    );
  }

  return pages;
}

function agentMenu(session) {
  const pages = getAgentPages();

  const page =
    pages[session.agentPage] || pages[0];

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("calc_agents")
      .setPlaceholder(
        session.agents.length
          ? `${session.agents.length} agent(s) selected`
          : "🎯 Select Agent Request(s)"
      )
      .setMinValues(0)
      .setMaxValues(page.length)
      .addOptions(
        page.map(agent => ({
          label: agent,
          value: normalizeAgent(agent),
          emoji: "🎯",
          default:
            session.agents.some(
              selected =>
                normalizeAgent(selected) ===
                normalizeAgent(agent)
            )
        }))
      )
  );
}

// =====================================================
// FINAL ACTION BUTTONS
// =====================================================

function calculatorActionButtons(session) {
  const pages = getAgentPages();

  return new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId("calc_agent_previous")
      .setLabel("Previous")
      .setEmoji("⬅️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(
        session.agentPage === 0
      ),

    new ButtonBuilder()
      .setCustomId("calc_agent_page")
      .setLabel(
        `Page ${session.agentPage + 1}/${pages.length}`
      )
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),

    new ButtonBuilder()
      .setCustomId("calc_agent_next")
      .setLabel("Next")
      .setEmoji("➡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(
        session.agentPage >= pages.length - 1
      ),

    new ButtonBuilder()
      .setCustomId("calc_calculate")
      .setLabel("Calculate Price")
      .setEmoji("💰")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("calc_reset")
      .setLabel("Reset")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Danger)

  );
}

// =====================================================
// WIZARD EMBED
// =====================================================

function calculatorWizardEmbed(session) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("🧮 BARCODE PRICE CALCULATOR")
    .setDescription(
      [
        "Select everything using the buttons/dropdowns below.",
        "",
        `🎮 **Current Rank:** ${
          session.current
            ? rankName(session.current)
            : "Not selected"
        }`,

        `🏆 **Desired Rank:** ${
          session.target
            ? rankName(session.target)
            : "Not selected"
        }`,

        `🎯 **Agents:** ${
          session.agents.length
            ? session.agents.join(", ")
            : "None"
        }`,

        `⚡ **Rush:** ${
          session.rush
            ? "ON (+50%)"
            : "OFF"
        }`,

        `🤝 **Party:** ${
          session.party
            ? "ON (x2.5)"
            : "OFF"
        }`,

        `📈 **Level Boost:** ${
          session.levels > 0
            ? `${session.levels} level(s)`
            : "None"
        }`,

        "",
        "💰 **Click Calculate Price when you're finished.**"
      ].join("\n")
    )
    .setFooter({
      text: "BARCODE Valorant Boosting Services"
    });
}

// =====================================================
// ALL CALCULATOR COMPONENTS
// IMPORTANT: EXACTLY 5 ROWS
// =====================================================

function calculatorComponents(session) {
  return [

    // ROW 1
    currentRankMenu(session),

    // ROW 2
    targetRankMenu(session),

    // ROW 3
    serviceButtons(session),

    // ROW 4
    agentMenu(session),

    // ROW 5
    calculatorActionButtons(session)

  ];
}

// =====================================================
// SLASH COMMANDS
// =====================================================

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
          .setDescription("Current rank")
          .setRequired(true)
      )
    )
    .addStringOption(o =>
      addRankChoices(
        o
          .setName("target")
          .setDescription("Target rank")
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
          "Agents separated by commas"
        )
    )
    .addIntegerOption(o =>
      o
        .setName("levels")
        .setDescription(
          "Level Boost"
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
        .setDescription("New value")
        .setRequired(true)
        .setMinValue(0)
    ),

  // /setupcalculator
  new SlashCommandBuilder()
    .setName("setupcalculator")
    .setDescription(
      "Admin: create the calculator panel."
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild.toString()
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

// =====================================================
// REGISTER COMMANDS
// =====================================================

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

// =====================================================
// READY
// =====================================================

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

// =====================================================
// INTERACTIONS
// =====================================================

client.on(
  "interactionCreate",
  async interaction => {

    try {

      // =================================================
      // BUTTONS
      // =================================================

      if (interaction.isButton()) {

        // -----------------------------------------------
        // START CALCULATOR
        // -----------------------------------------------

        if (
          interaction.customId ===
          "calculator_start"
        ) {

          const session =
            resetSession(
              interaction.user.id
            );

          return interaction.reply({

            ephemeral: true,

            embeds: [
              calculatorWizardEmbed(
                session
              )
            ],

            components:
              calculatorComponents(
                session
              )

          });

        }

        // -----------------------------------------------
        // EVERYTHING BELOW THIS POINT
        // ACKNOWLEDGES THE BUTTON IMMEDIATELY
        // -----------------------------------------------

        await interaction.deferUpdate();

        const session =
          getSession(
            interaction.user.id
          );

        // -----------------------------------------------
        // RUSH
        // -----------------------------------------------

        if (
          interaction.customId ===
          "calc_rush"
        ) {

          session.rush =
            !session.rush;

          return interaction.editReply({

            embeds: [
              calculatorWizardEmbed(
                session
              )
            ],

            components:
              calculatorComponents(
                session
              )

          });

        }

        // -----------------------------------------------
        // PARTY
        // -----------------------------------------------

        if (
          interaction.customId ===
          "calc_party"
        ) {

          session.party =
            !session.party;

          return interaction.editReply({

            embeds: [
              calculatorWizardEmbed(
                session
              )
            ],

            components:
              calculatorComponents(
                session
              )

          });

        }

        // -----------------------------------------------
        // LEVEL DOWN
        // -----------------------------------------------

        if (
          interaction.customId ===
          "calc_level_down"
        ) {

          if (
            session.levels > 0
          ) {
            session.levels--;
          }

          return interaction.editReply({

            embeds: [
              calculatorWizardEmbed(
                session
              )
            ],

            components:
              calculatorComponents(
                session
              )

          });

        }

        // -----------------------------------------------
        // LEVEL UP
        // -----------------------------------------------

        if (
          interaction.customId ===
          "calc_level_up"
        ) {

          if (
            session.levels < 20
          ) {
            session.levels++;
          }

          return interaction.editReply({

            embeds: [
              calculatorWizardEmbed(
                session
              )
            ],

            components:
              calculatorComponents(
                session
              )

          });

        }

        // -----------------------------------------------
        // AGENT PREVIOUS
        // -----------------------------------------------

        if (
          interaction.customId ===
          "calc_agent_previous"
        ) {

          if (
            session.agentPage > 0
          ) {
            session.agentPage--;
          }

          return interaction.editReply({

            embeds: [
              calculatorWizardEmbed(
                session
              )
            ],

            components:
              calculatorComponents(
                session
              )

          });

        }

        // -----------------------------------------------
        // AGENT NEXT
        // -----------------------------------------------

        if (
          interaction.customId ===
          "calc_agent_next"
        ) {

          const pages =
            getAgentPages();

          if (
            session.agentPage <
            pages.length - 1
          ) {
            session.agentPage++;
          }

          return interaction.editReply({

            embeds: [
              calculatorWizardEmbed(
                session
              )
            ],

            components:
              calculatorComponents(
                session
              )

          });

        }

        // -----------------------------------------------
        // RESET
        // -----------------------------------------------

        if (
          interaction.customId ===
          "calc_reset"
        ) {

          const newSession =
            resetSession(
              interaction.user.id
            );

          return interaction.editReply({

            embeds: [
              calculatorWizardEmbed(
                newSession
              )
            ],

            components:
              calculatorComponents(
                newSession
              )

          });

        }

        // -----------------------------------------------
        // CALCULATE
        // -----------------------------------------------

        if (
          interaction.customId ===
          "calc_calculate"
        ) {

          if (
            !session.current
          ) {

            return interaction.editReply({

              embeds: [
                errorEmbed(
                  "Please select your **Current Rank** first."
                )
              ],

              components:
                calculatorComponents(
                  session
                )

            });

          }

          if (
            !session.target
          ) {

            return interaction.editReply({

              embeds: [
                errorEmbed(
                  "Please select your **Desired Rank** first."
                )
              ],

              components:
                calculatorComponents(
                  session
                )

            });

          }

          let calculation;

          try {

            calculation =
              calculateRankBoost(
                session.current,
                session.target
              );

          } catch (e) {

            return interaction.editReply({

              embeds: [
                errorEmbed(
                  e.message
                )
              ],

              components:
                calculatorComponents(
                  session
                )

            });

          }

          // ---------------------------------------------
          // RADIANT
          // ---------------------------------------------

          if (
            calculation.radiant
          ) {

            return interaction.editReply({

              embeds: [
                resultEmbed(
                  "⭐ Radiant Boost",
                  [
                    {
                      name:
                        "Current Rank",
                      value:
                        rankName(
                          session.current
                        )
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
              ],

              components: []

            });

          }

          // ---------------------------------------------
          // BASE PRICE
          // ---------------------------------------------

          let subtotal =
            calculation.total;

          const additions = [];

          // ---------------------------------------------
          // AGENTS
          // ---------------------------------------------

          if (
            session.agents.length > 0
          ) {

            const agentFee =
              session.agents.length *
              AGENT_PRICE;

            subtotal +=
              agentFee;

            additions.push(
              `🎯 ${session.agents.length} Agent(s): +${money(
                agentFee
              )}`
            );

          }

          // ---------------------------------------------
          // LEVEL BOOST
          // ---------------------------------------------

          if (
            session.levels > 0
          ) {

            const config =
              loadConfig();

            const levelPrice =
              config.fees.level_per_level;

            const levelFee =
              session.levels *
              levelPrice;

            subtotal +=
              levelFee;

            additions.push(
              `📈 Level Boost (${session.levels}): +${money(
                levelFee
              )}`
            );

          }

          // ---------------------------------------------
          // PARTY
          // ---------------------------------------------

          if (
            session.party
          ) {

            const config =
              loadConfig();

            subtotal *=
              config.fees.party_multiplier;

            additions.push(
              `🤝 Party Boost: x${config.fees.party_multiplier}`
            );

          }

          // ---------------------------------------------
          // RUSH
          // ---------------------------------------------

          if (
            session.rush
          ) {

            const config =
              loadConfig();

            const rushFee =
              subtotal *
              (
                config.fees.rush_percent /
                100
              );

            subtotal +=
              rushFee;

            additions.push(
              `⚡ Rush/Priority: +${money(
                rushFee
              )}`
            );

          }

          // ---------------------------------------------
          // RESULT
          // ---------------------------------------------

          return interaction.editReply({

            embeds: [
              resultEmbed(
                "🎮 BARCODE BOOST CALCULATOR",
                [

                  {
                    name:
                      "Current Rank",
                    value:
                      rankName(
                        session.current
                      ),
                    inline: true
                  },

                  {
                    name:
                      "Target Rank",
                    value:
                      rankName(
                        session.target
                      ),
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
                      session.agents.length
                        ? session.agents.join(
                            ", "
                          )
                        : "None"
                  },

                  {
                    name:
                      "⚡ Rush",
                    value:
                      session.rush
                        ? "Yes (+50%)"
                        : "No",
                    inline: true
                  },

                  {
                    name:
                      "🤝 Party",
                    value:
                      session.party
                        ? "Yes (x2.5)"
                        : "No",
                    inline: true
                  },

                  {
                    name:
                      "📈 Level Boost",
                    value:
                      session.levels > 0
                        ? `${session.levels} level(s)`
                        : "None",
                    inline: true
                  },

                  {
                    name:
                      "Add-ons",
                    value:
                      additions.length
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
            ],

            components: []

          });

        }

        return;
      }

      // =================================================
      // SELECT MENUS
      // =================================================

      if (
        interaction.isStringSelectMenu()
      ) {

        // Immediately acknowledge dropdown
        await interaction.deferUpdate();

        const session =
          getSession(
            interaction.user.id
          );

        // -----------------------------------------------
        // CURRENT RANK
        // -----------------------------------------------

        if (
          interaction.customId ===
          "calc_current_rank"
        ) {

          session.current =
            interaction.values[0];

        }

        // -----------------------------------------------
        // TARGET RANK
        // -----------------------------------------------

        else if (
          interaction.customId ===
          "calc_target_rank"
        ) {

          session.target =
            interaction.values[0];

        }

        // -----------------------------------------------
        // AGENTS
        // -----------------------------------------------

        else if (
          interaction.customId ===
          "calc_agents"
        ) {

          const currentPage =
            getAgentPages()[
              session.agentPage
            ] || [];

          const selectedValues =
            interaction.values;

          // Remove all agents currently on this page
          // so the dropdown can toggle selections.
          session.agents =
            session.agents.filter(
              selected =>
                !currentPage.some(
                  pageAgent =>
                    normalizeAgent(
                      pageAgent
                    ) ===
                    normalizeAgent(
                      selected
                    )
                )
            );

          // Add selected agents
          for (
            const selectedValue
            of selectedValues
          ) {

            const realAgent =
              uniqueAgents.find(
                agent =>
                  normalizeAgent(
                    agent
                  ) ===
                  normalizeAgent(
                    selectedValue
                  )
              );

            if (
              realAgent &&
              !session.agents.some(
                existing =>
                  normalizeAgent(
                    existing
                  ) ===
                  normalizeAgent(
                    realAgent
                  )
              )
            ) {

              session.agents.push(
                realAgent
              );

            }

          }

        }

        return interaction.editReply({

          embeds: [
            calculatorWizardEmbed(
              session
            )
          ],

          components:
            calculatorComponents(
              session
            )

        });

      }

      // =================================================
      // SLASH COMMANDS
      // =================================================

      if (
        !interaction.isChatInputCommand()
      ) {
        return;
      }

      // Immediately acknowledge slash commands
      await interaction.deferReply({
        ephemeral: true
      });

      const config =
        loadConfig();

      // =================================================
      // /CALC
      // =================================================

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

          return interaction.editReply({

            embeds: [
              errorEmbed(
                "Only numbers and +, -, *, /, %, and parentheses are allowed."
              )
            ]

          });

        }

        let result;

        try {

          result =
            Function(
              `"use strict"; return (${expression})`
            )();

        } catch {

          return interaction.editReply({

            embeds: [
              errorEmbed(
                "That expression could not be calculated."
              )
            ]

          });

        }

        if (
          !Number.isFinite(result)
        ) {

          return interaction.editReply({

            embeds: [
              errorEmbed(
                "The result is not a valid number."
              )
            ]

          });

        }

        return interaction.editReply({

          embeds: [
            resultEmbed(
              "🧮 Calculator",
              [
                {
                  name:
                    "Expression",
                  value:
                    `\`${expression}\``
                },

                {
                  name:
                    "Result",
                  value:
                    `**${result}**`
                }
              ]
            )
          ]

        });

      }

      // =================================================
      // /PRICE
      // =================================================

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

          return interaction.editReply({

            embeds: [
              resultEmbed(
                "⭐ Radiant",
                [
                  {
                    name:
                      "Price",
                    value:
                      "**Negotiable / Price may vary**"
                  }
                ]
              )
            ]

          });

        }

        return interaction.editReply({

          embeds: [
            resultEmbed(
              "🎮 BARCODE Rank Price",
              [
                {
                  name:
                    "Rank",
                  value:
                    rankName(rank),
                  inline: true
                },

                {
                  name:
                    "Price",
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

      // =================================================
      // /PRICES
      // =================================================

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
            );

        return interaction.editReply({
          embeds: [embed]
        });

      }

      // =================================================
      // /FEES
      // =================================================

      if (
        interaction.commandName ===
        "fees"
      ) {

        const f =
          config.fees;

        return interaction.editReply({

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

      // =================================================
      // /SETUPCALCULATOR
      // =================================================

      if (
        interaction.commandName ===
        "setupcalculator"
      ) {

        await interaction.channel.send({

          embeds: [
            calculatorPanelEmbed()
          ],

          components:
            calculatorPanelComponents()

        });

        return interaction.editReply({

          content:
            "✅ Calculator panel created in this channel."

        });

      }

      // =================================================
      // /BOOST
      // =================================================

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

        const levels =
          interaction.options.getInteger(
            "levels"
          ) ?? 0;

        const agentInput =
          interaction.options.getString(
            "agents"
          ) ?? "";

        let calculation;

        try {

          calculation =
            calculateRankBoost(
              current,
              target
            );

        } catch (e) {

          return interaction.editReply({

            embeds: [
              errorEmbed(
                e.message
              )
            ]

          });

        }

        if (
          calculation.radiant
        ) {

          return interaction.editReply({

            embeds: [
              resultEmbed(
                "⭐ Radiant Boost",
                [
                  {
                    name:
                      "Current Rank",
                    value:
                      rankName(current)
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
                  }
                ]
              )
            ]

          });

        }

        let subtotal =
          calculation.total;

        const additions = [];

        let selectedAgents = [];

        if (
          agentInput.trim()
        ) {

          selectedAgents =
            agentInput
              .split(",")
              .map(
                x => x.trim()
              )
              .filter(Boolean);

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
            invalidAgents.length
          ) {

            return interaction.editReply({

              embeds: [
                errorEmbed(
                  `Invalid agent(s): **${invalidAgents.join(
                    ", "
                  )}**`
                )
              ]

            });

          }

          const agentFee =
            selectedAgents.length *
            AGENT_PRICE;

          subtotal +=
            agentFee;

          additions.push(
            `🎯 ${selectedAgents.length} Agent(s): +${money(
              agentFee
            )}`
          );

        }

        if (
          levels > 0
        ) {

          const levelFee =
            levels *
            config.fees.level_per_level;

          subtotal +=
            levelFee;

          additions.push(
            `📈 Level Boost (${levels}): +${money(
              levelFee
            )}`
          );

        }

        if (
          party
        ) {

          subtotal *=
            config.fees.party_multiplier;

          additions.push(
            `🤝 Party Boost: x${config.fees.party_multiplier}`
          );

        }

        if (
          rush
        ) {

          const rushFee =
            subtotal *
            (
              config.fees.rush_percent /
              100
            );

          subtotal +=
            rushFee;

          additions.push(
            `⚡ Rush/Priority: +${money(
              rushFee
            )}`
          );

        }

        return interaction.editReply({

          embeds: [
            resultEmbed(
              "🎮 BARCODE BOOST CALCULATOR",
              [

                {
                  name:
                    "Current Rank",
                  value:
                    rankName(current),
                  inline: true
                },

                {
                  name:
                    "Target Rank",
                  value:
                    rankName(target),
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
                    selectedAgents.length
                      ? selectedAgents.join(
                          ", "
                        )
                      : "None"
                },

                {
                  name:
                    "Add-ons",
                  value:
                    additions.length
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

      // =================================================
      // /SETPRICE
      // =================================================

      if (
        interaction.commandName ===
        "setprice"
      ) {

        const rank =
          interaction.options.getString(
            "rank"
          );

        const amount =
          interaction.options.getInteger(
            "amount"
          );

        if (
          rank === "radiant"
        ) {

          return interaction.editReply({

            embeds: [
              errorEmbed(
                "Radiant does not use a fixed price."
              )
            ]

          });

        }

        config.ranks[rank] =
          amount;

        saveConfig(config);

        return interaction.editReply({

          embeds: [
            resultEmbed(
              "✅ Price Updated",
              [
                {
                  name:
                    "Rank",
                  value:
                    rankName(rank)
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

      // =================================================
      // /SETFEE
      // =================================================

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

        return interaction.editReply({

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

      // =================================================
      // /HELP
      // =================================================

      if (
        interaction.commandName ===
        "help"
      ) {

        return interaction.editReply({

          embeds: [
            resultEmbed(
              "🤖 BARCODE CALCULATOR BOT",
              [
                {
                  name:
                    "/boost",
                  value:
                    "Calculate a boost using slash command options."
                },

                {
                  name:
                    "/setupcalculator",
                  value:
                    "Create the click-only calculator panel."
                },

                {
                  name:
                    "🎯 Agent Request",
                  value:
                    "₱100 per selected agent."
                },

                {
                  name:
                    "⚡ Rush",
                  value:
                    "+50% of the calculated price."
                },

                {
                  name:
                    "🤝 Party",
                  value:
                    "x2.5 multiplier."
                },

                {
                  name:
                    "📈 Level Boost",
                  value:
                    `+${money(
                      config.fees.level_per_level
                    )} per level.`
                },

                {
                  name:
                    "/prices",
                  value:
                    "Show all rank prices."
                },

                {
                  name:
                    "/fees",
                  value:
                    "Show all additional fees."
                }
              ]
            )
          ]

        });

      }

    } catch (err) {

      console.error(
        "Interaction error:",
        err
      );

      try {

        if (
          interaction.deferred ||
          interaction.replied
        ) {

          await interaction.editReply({

            embeds: [
              errorEmbed(
                "Something went wrong while processing that interaction."
              )
            ],

            components: []

          });

        } else {

          await interaction.reply({

            embeds: [
              errorEmbed(
                "Something went wrong while processing that interaction."
              )
            ],

            ephemeral: true

          });

        }

      } catch (errorReply) {

        console.error(
          "Error sending error message:",
          errorReply
        );

      }

    }

  }
);

// =====================================================
// ENVIRONMENT VARIABLES
// =====================================================

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

// =====================================================
// LOGIN
// =====================================================

client.login(
  process.env.DISCORD_TOKEN
);
