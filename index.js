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

// =====================================================
// SESSION STORAGE
// =====================================================

const calculatorSessions = new Map();

function getSession(userId) {
  if (!calculatorSessions.has(userId)) {
    calculatorSessions.set(userId, {
      current: null,
      target: null,
      rush: false,
      party: false,
      agents: [],
      levels: 0,
      agentPage: 0
    });
  }

  return calculatorSessions.get(userId);
}

function resetSession(userId) {
  calculatorSessions.set(userId, {
    current: null,
    target: null,
    rush: false,
    party: false,
    agents: [],
    levels: 0,
    agentPage: 0
  });

  return calculatorSessions.get(userId);
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
        "🎮 **Select your Current Rank**",
        "🏆 **Select your Desired Rank**",
        "⚡ **Choose Rush/Priority Boost**",
        "🤝 **Choose Party Boost**",
        "🎯 **Select your Agent Requests**",
        "📈 **Choose Level Boost**",
        "",
        "💰 Your total will be calculated automatically.",
        "",
        "**Click the button below to start.**"
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
// RANK MENUS
// =====================================================

function currentRankMenu(session) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("calc_current_rank")
      .setPlaceholder(
        session.current
          ? `Current: ${rankName(session.current)}`
          : "Select your Current Rank"
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

function targetRankMenu(session) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("calc_target_rank")
      .setPlaceholder(
        session.target
          ? `Desired: ${rankName(session.target)}`
          : "Select your Desired Rank"
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
// SERVICE MENU
// =====================================================

function serviceMenu(session) {
  const selected = [];

  if (session.rush) {
    selected.push("rush");
  }

  if (session.party) {
    selected.push("party");
  }

  if (session.levels > 0) {
    selected.push("level");
  }

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("calc_services")
      .setPlaceholder(
        selected.length
          ? "Services selected"
          : "Select Additional Services"
      )
      .setMinValues(0)
      .setMaxValues(3)
      .addOptions([
        {
          label: "Rush / Priority Boost",
          description: "Adds the Rush percentage",
          value: "rush",
          emoji: "⚡",
          default: session.rush
        },
        {
          label: "Party Boost",
          description: "Multiplies the total price",
          value: "party",
          emoji: "🤝",
          default: session.party
        },
        {
          label: "Level Boost",
          description: "Add levels after selecting services",
          value: "level",
          emoji: "📈",
          default: session.levels > 0
        }
      ])
  );
}

// =====================================================
// LEVEL MENU
// =====================================================

function levelMenu(session) {
  const options = [];

  for (let i = 0; i <= 20; i++) {
    options.push({
      label:
        i === 0
          ? "No Level Boost"
          : `${i} Level${i > 1 ? "s" : ""}`,
      value: String(i),
      emoji: "📈",
      default: session.levels === i
    });
  }

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("calc_levels")
      .setPlaceholder(
        session.levels > 0
          ? `Level Boost: ${session.levels}`
          : "Select Level Boost"
      )
      .addOptions(options)
  );
}

// =====================================================
// AGENT MENU
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
        session.agents.length > 0
          ? `${session.agents.length} agent(s) selected`
          : "Select Agent Request(s)"
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

function agentPageButtons(session) {
  const pages = getAgentPages();

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("calc_agent_previous")
      .setLabel("Previous")
      .setEmoji("⬅️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(session.agentPage === 0),

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
      )
  );
}

// =====================================================
// ACTION BUTTONS
// =====================================================

function calculatorActions() {
  return new ActionRowBuilder().addComponents(
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
        "Select your options below.",
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
          session.rush ? "Yes" : "No"
        }`,
        `🤝 **Party:** ${
          session.party ? "Yes" : "No"
        }`,
        `📈 **Level Boost:** ${
          session.levels > 0
            ? session.levels
            : "None"
        }`,
        "",
        "When finished, click **Calculate Price**."
      ].join("\n")
    );
}

function calculatorComponents(session) {
  return [
    currentRankMenu(session),
    targetRankMenu(session),
    serviceMenu(session),
    agentMenu(session),
    agentPageButtons(session),
    levelMenu(session),
    calculatorActions()
  ];
}

// =====================================================
// SLASH COMMANDS
// =====================================================

const commands = [

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

  new SlashCommandBuilder()
    .setName("prices")
    .setDescription(
      "Show the complete BARCODE price list."
    ),

  new SlashCommandBuilder()
    .setName("fees")
    .setDescription(
      "Show current BARCODE add-on fees."
    ),

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

  new SlashCommandBuilder()
    .setName("setupcalculator")
    .setDescription(
      "Admin: create the calculator panel in this channel."
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild.toString()
    ),

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

        // IMPORTANT:
        // Acknowledge immediately to prevent timeout.
        await interaction.deferUpdate();

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

          const session =
            resetSession(
              interaction.user.id
            );

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

          const session =
            getSession(
              interaction.user.id
            );

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

          const session =
            getSession(
              interaction.user.id
            );

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
        // CALCULATE
        // -----------------------------------------------

        if (
          interaction.customId ===
          "calc_calculate"
        ) {

          const session =
            getSession(
              interaction.user.id
            );

          if (!session.current) {

            return interaction.editReply({

              embeds: [
                errorEmbed(
                  "Please select your **Current Rank** first."
                )
              ],

              components: []

            });

          }

          if (!session.target) {

            return interaction.editReply({

              embeds: [
                errorEmbed(
                  "Please select your **Desired Rank** first."
                )
              ],

              components: []

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

              components: []

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
          // BASE
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
              `🎯 Agent Request (${session.agents.join(
                ", "
              )}): +${money(
                agentFee
              )}`
            );

          }

          // ---------------------------------------------
          // LEVELS
          // ---------------------------------------------

          if (
            session.levels > 0
          ) {

            const config =
              loadConfig();

            const levelFee =
              session.levels *
              config.fees.level_per_level;

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

        // IMPORTANT:
        // Acknowledge immediately.
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
        // SERVICES
        // -----------------------------------------------

        else if (
          interaction.customId ===
          "calc_services"
        ) {

          const selected =
            interaction.values;

          session.rush =
            selected.includes(
              "rush"
            );

          session.party =
            selected.includes(
              "party"
            );

          if (
            !selected.includes(
              "level"
            )
          ) {

            session.levels = 0;

          }

        }

        // -----------------------------------------------
        // LEVELS
        // -----------------------------------------------

        else if (
          interaction.customId ===
          "calc_levels"
        ) {

          session.levels =
            Number(
              interaction.values[0]
            );

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

          const selectedOnPage =
            interaction.values;

          // Remove agents from current page
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
            of selectedOnPage
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

      // =================================================
      // IMPORTANT:
      // Acknowledge slash command immediately.
      // This prevents "didn't respond in time".
      // =================================================

      await interaction.deferReply({
        ephemeral:
          interaction.commandName !== "prices" &&
          interaction.commandName !== "fees" &&
          interaction.commandName !== "help" &&
          interaction.commandName !== "calc"
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

        return interaction.editReply({

          embeds: [
            resultEmbed(
              "🎮 BARCODE Rank Price",
              [
                {
                  name: "Rank",
                  value:
                    rankName(rank),
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
            )
            .setFooter({
              text:
                "Prices may vary. Send BARCODE a PM for a quote."
            });

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

        const agentInput =
          interaction.options.getString(
            "agents"
          ) ?? "";

        const levels =
          interaction.options.getInteger(
            "levels"
          ) ?? 0;

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

        // -----------------------------------------------
        // RADIANT
        // -----------------------------------------------

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

        let subtotal =
          calculation.total;

        const additions = [];

        // -----------------------------------------------
        // AGENTS
        // -----------------------------------------------

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
            invalidAgents.length > 0
          ) {

            return interaction.editReply({

              embeds: [
                errorEmbed(
                  `Invalid agent(s): **${invalidAgents.join(
                    ", "
                  )}**\n\nPlease use valid Valorant agent names.`
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
            `🎯 Agent Request (${selectedAgents.join(
              ", "
            )}): +${money(
              agentFee
            )}`
          );

        }

        // -----------------------------------------------
        // LEVEL BOOST
        // -----------------------------------------------

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

        // -----------------------------------------------
        // PARTY
        // -----------------------------------------------

        if (
          party
        ) {

          subtotal *=
            config.fees.party_multiplier;

          additions.push(
            `🤝 Party Boost: x${config.fees.party_multiplier}`
          );

        }

        // -----------------------------------------------
        // RUSH
        // -----------------------------------------------

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

        const agentDisplay =
          selectedAgents.length > 0
            ? selectedAgents.join(", ")
            : "None";

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

        if (
          rank === "radiant"
        ) {

          return interaction.editReply({

            embeds: [
              errorEmbed(
                "Radiant is negotiable and does not use a fixed price."
              )
            ]

          });

        }

        const amount =
          interaction.options.getInteger(
            "amount"
          );

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
                    "/setupcalculator",
                  value:
                    "Admin-only: create the calculator panel in the current channel."
                },
                {
                  name:
                    "🎯 Agent Request",
                  value:
                    "Each selected agent costs ₱100."
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
                "Something went wrong while processing that command."
              )
            ],

            components: []

          });

        } else {

          await interaction.reply({

            embeds: [
              errorEmbed(
                "Something went wrong while processing that command."
              )
            ],

            ephemeral: true

          });

        }

      } catch (replyError) {

        console.error(
          "Could not send error response:",
          replyError
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
