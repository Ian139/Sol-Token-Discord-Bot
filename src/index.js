const {
	Client,
	GatewayIntentBits,
	REST,
	Routes,
	SlashCommandBuilder,
} = require("discord.js");
const axios = require("axios");
require("dotenv").config();

const client = new Client({
	intents: [GatewayIntentBits.Guilds],
});

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// Define the slash command
const command = new SlashCommandBuilder()
	.setName("price")
	.setDescription("Get the price of a token")
	.addStringOption((option) =>
		option
			.setName("symbol")
			.setDescription("The token symbol (e.g., BTC, ETH, SOL)")
			.setRequired(true)
	);

// Replace GUILD_ID with your server's ID
const GUILD_ID = process.env.GUILD_ID;

// Add this before your command registration
(async () => {
	try {
		await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID), { body: [] });
		console.log('Cleared all guild commands.');

		console.log("Started refreshing application (/) commands.");

		const data = await rest.put(
			Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
			{ body: [command.toJSON()] }
		);

		console.log(
			`Successfully reloaded ${data.length} application (/) commands.`
		);
	} catch (error) {
		console.error("Error registering commands:", error);
	}
})();

client.once("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on("interactionCreate", async (interaction) => {
	if (!interaction.isCommand()) return;

	if (interaction.commandName === "price") {
		const symbol = interaction.options.getString("symbol").toUpperCase();

		await interaction.deferReply();

		try {
			const response = await axios.get(
				`https://api.dexscreener.com/latest/dex/search/?q=${symbol}`
			);
			
			const pairs = response.data.pairs;
			if (pairs && pairs.length > 0) {
				// Sort pairs by liquidity and get the top one
				const topPair = pairs.sort((a, b) => b.liquidity.usd - a.liquidity.usd)[0];
				const price = topPair.priceUsd;
				const chainId = topPair.chainId;
				const dexId = topPair.dexId;

				await interaction.editReply(
					`The current price of ${symbol} is $${price}\nChain: ${chainId}\nDEX: ${dexId}`
				);
			} else {
				await interaction.editReply(
					`Couldn't find price information for ${symbol}. Please check the token symbol and try again.`
				);
			}
		} catch (error) {
			console.error("Error fetching price:", error);
			if (error.response && error.response.status === 429) {
				await interaction.editReply(
					"Rate limit exceeded. Please try again later."
				);
			} else {
				await interaction.editReply(
					"Error fetching price. Please try again later."
				);
			}
		}
	}
});

if (!process.env.TOKEN) {
	console.error("Discord bot token not found in environment variables.");
	process.exit(1);
}

client.login(process.env.TOKEN);
