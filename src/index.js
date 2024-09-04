const {
	Client,
	GatewayIntentBits,
	REST,
	Routes,
	SlashCommandBuilder,
	EmbedBuilder,
} = require("discord.js");
const axios = require("axios");
const sharp = require("sharp");
const ColorThief = require("colorthief");
require("dotenv").config();

const client = new Client({
	intents: [GatewayIntentBits.Guilds],
});

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// Define the token command
const tokenCommand = new SlashCommandBuilder()
	.setName("token")
	.setDescription("Get token information")
	.addStringOption((option) =>
		option
			.setName("symbol")
			.setDescription("The token symbol (e.g., BTC, ETH, SOL)")
			.setRequired(true)
	);

// Replace GUILD_ID with your server's ID
const GUILD_ID = process.env.GUILD_ID;

// Modify this function to ensure the token command is present
async function restartCommands() {
	try {
		console.log('Fetching existing commands...');
		const existingCommands = await rest.get(
			Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID)
		);

		console.log('Checking for token command...');
		const tokenCommandExists = existingCommands.some(cmd => cmd.name === 'token');

		let updatedCommands;
		if (tokenCommandExists) {
			console.log('Token command exists, removing other commands...');
			updatedCommands = existingCommands.filter(cmd => cmd.name === 'token');
		} else {
			console.log('Token command does not exist, adding it...');
			updatedCommands = [tokenCommand.toJSON()];
		}

		console.log('Updating guild commands...');
		await rest.put(
			Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
			{ body: updatedCommands }
		);
		console.log('Successfully updated guild commands. Only token command should be present.');
	} catch (error) {
		console.error('Error managing commands:', error);
	}
}

// Call restartCommands when the bot is ready
client.once("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);
	restartCommands();
});

async function getAverageColor(imageUrl) {
	try {
		const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
		const buffer = Buffer.from(response.data, "binary");
		const image = await sharp(buffer).resize(50, 50).toBuffer();
		const [r, g, b] = await ColorThief.getColor(image);
		return (r << 16) + (g << 8) + b;
	} catch (error) {
		console.error("Error getting average color:", error);
		return 0x000000; // Default to black if there's an error
	}
}

client.on("interactionCreate", async (interaction) => {
	if (!interaction.isCommand()) return;

	if (interaction.commandName === "token") {
		const symbol = interaction.options.getString("symbol").toUpperCase();

		await interaction.deferReply();

		try {
			const response = await axios.get(
				`https://api.dexscreener.com/latest/dex/search/?q=${symbol}`
			);

			const pairs = response.data.pairs;
			if (pairs && pairs.length > 0) {
				const topPair = pairs.sort(
					(a, b) => b.liquidity.usd - a.liquidity.usd
				)[0];
				const price = topPair.priceUsd;
				const chainId = topPair.chainId;
				const dexId = topPair.dexId;
				const mcap = topPair.fdv;
				const logoUrl =
					topPair.baseToken.logoURI || "https://example.com/default-logo.png";

				const embedColor = await getAverageColor(logoUrl);

				const embed = new EmbedBuilder()
					.setColor(embedColor)
					.setTitle(`${symbol} Token Information`)
					.setThumbnail(logoUrl)
					.setImage(logoUrl) // Add this line to set the main image
					.addFields(
						{
							name: "Price",
							value: `$${parseFloat(price).toFixed(6)}`,
							inline: true,
						},
						{
							name: "Market Cap",
							value: mcap ? `$${parseInt(mcap).toLocaleString()}` : "N/A",
							inline: true,
						},
						{ name: "Chain", value: chainId, inline: true },
						{ name: "DEX", value: dexId, inline: true }
					)
					.setTimestamp();

				await interaction.editReply({ embeds: [embed] });
			} else {
				await interaction.editReply(
					`Couldn't find information for ${symbol}. Please check the token symbol and try again.`
				);
			}
		} catch (error) {
			console.error("Error fetching token information:", error);
			if (error.response && error.response.status === 429) {
				await interaction.editReply(
					"Rate limit exceeded. Please try again later."
				);
			} else {
				await interaction.editReply(
					"Error fetching token information. Please try again later."
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
