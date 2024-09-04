const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config();

const clientId = process.env.CLIENT_ID;
const token = process.env.DISCORD_TOKEN;

const commands = [];

// Manually define the token command
const tokenCommand = new SlashCommandBuilder()
	.setName("token")
	.setDescription("Get token information")
	.addStringOption((option) =>
		option
			.setName("symbol")
			.setDescription("The token symbol (e.g., BTC, ETH, SOL)")
			.setRequired(true)
	);

// Add the token command to the commands array
commands.push(tokenCommand.toJSON());

console.log(
	`Manually added token command. Total commands to be registered: ${commands.length}`
);

const rest = new REST().setToken(token);

async function restartCommands() {
	try {
		console.log("Started refreshing application (/) commands.");

		await rest.put(
			Routes.applicationGuildCommands(
				process.env.CLIENT_ID,
				process.env.GUILD_ID
			),
			{ body: commands }
		);

		console.log("Successfully reloaded application (/) commands.");
	} catch (error) {
		console.error(error);
	}
}

module.exports = { restartCommands };
