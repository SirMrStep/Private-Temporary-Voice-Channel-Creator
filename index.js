/**
 * This project made me realise just how fucking annoying discord.js is to work with. FUCK THAT SHIT
 * With that said if you run into any errors hit me up - (.steep)
 * 
 * Dont forget to put your token in token.json
 */

class Deleter {

  constructor() {
    this.list = [];
    this.deleting = false;
  }

  async add(channel) {

    if(this.list.includes(channel)) return;

    this.list.push(channel);
    
    await this.start();
 
  }

  remove(index) {

    this.list.splice(index, 1);

    if(this.list.length < 1) this.deleting = false;

  }

  async start() {

    if(this.deleting) return;

    this.deleting = true;

    for(var index = 0; index < this.list.length; index++) {

      const vc = this.list[0];
      
      if(!await isTempChannel(vc.id)) {
          
        try {

          vc.delete().catch(err => console.log("Error while deleting non-temp channel: " + err)).finally(() => {
            this.remove(0);
          });

        } catch(err) {

          this.remove(0);

        }

      }

      if(vc.members === null || typeof(vc.members) === typeof(undefined) || vc.members.size < 1) {

        try {

          var id = vc.id;
          vc.delete().then(async () => {
            const data = await JSON.parse(fs.readFileSync("./temp_channels.json", { encoding: "utf8" }));
            data.splice(data.indexOf(id), 1);
            fs.writeFileSync("./temp_channels.json", JSON.stringify(data));
          }).catch(err => console.log("Error while deleting temp channel: " + err)).finally(() => {
            this.remove(0);
          });

        } catch(err) {

          this.remove(0);

        }

      }

      if((index - 1) === this.list.length && this.deleting) this.deleting = false;

    }

  }

}


const { EmbedBuilder } = require('@discordjs/builders');
const { Client, IntentsBitField, PermissionsBitField, ChannelType, NewsChannel, GuildMemberFlags, Colors, Embed} = require('discord.js');
const { token } = require('./token.json');
const deleter = new Map(); // map<guild, Deleter>
const muteRole = new Map(); // map<guild, role>
const deafRole = new Map(); // map<guild, role>
const fs = require("fs");

const client = new Client({ 
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildVoiceStates
  ]
});

client.login(token);

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {

  if(message.author.bot) return;

  const cmd = message.content.split(" ")[0];

  if(cmd.toLowerCase() !== "!channels") return;

  const args = message.content.replace("!channels ", "").split(" ");

  if(args.length > 2) return;

  var embed = new EmbedBuilder();
  var description = "";

  var channel = await message.guild.channels.fetch(args[0]).catch((reason) => description = "Could not find a channel with id '" + args[0] + "'!" /*+ reason*/);
  var category = await message.guild.channels.fetch(args[1]).catch((reason) => description = description + "\nCould not find a category with id '" + args[1] + "'!" /*+ reason*/);

  if(isNullOrUndefined(channel.name) || isNullOrUndefined(category.name)) {
    message.reply({ embeds: [embed.setTitle("Error").setDescription(description).setColor(Colors.Red)] });
    return;
  }

  if(fs.readFileSync("./channels.json", {encoding: 'utf8'}).length === 0) {

    fs.writeFileSync("./channels.json", JSON.stringify(createChannelData(message.guildId, args[0], args[1])));
    description = "Join-Channel set to: " + (!isNullOrUndefined(channel) ? channel.name : args[0]) + ".\n" + "Category set to: " + (!isNullOrUndefined(category) ? category.name : args[1]) + ".";
    message.reply({ embeds: [embed.setTitle("Success").setDescription(description).setColor(Colors.Green)] });
    return;

  }

  var data = await JSON.parse(fs.readFileSync("./channels.json", {encoding: 'utf8'}));

  if(isNullOrUndefined(data[message.guildId])) {

    fs.writeFileSync("./channels.json", JSON.stringify(createChannelData(message.guildId, args[0], args[1])));
    description = "Join-Channel set to: " + (!isNullOrUndefined(channel) ? channel.name : args[0]) + ".\n" + "Category set to: " + (!isNullOrUndefined(category) ? category.name : args[1]) + ".";
    message.reply({ embeds: [embed.setTitle("Success").setDescription(description).setColor(Colors.Green)] });
    return;

  }

  data[message.guildId].voiceChannel = args[0];
  data[message.guildId].categoryChannel = args[1];

  fs.writeFileSync("./channels.json", JSON.stringify(data));

  description = "Join-Channel set to: " + (!isNullOrUndefined(channel) ? channel.name : args[0]) + ".\n" + "Category set to: " + (!isNullOrUndefined(category) ? category.name : args[1]) + ".";
  
  message.reply({ embeds: [embed.setTitle("Success").setDescription(description).setColor(Colors.Green)] });

});

function createChannelData(guildID, voiceChannel, categoryChannel) {
  return Object.fromEntries(
        
    new Map([

      [
        guildID, Object.fromEntries(new Map([["voiceChannel", voiceChannel], ["categoryChannel", categoryChannel]]))
      ]

    ])

  );
}

/**
 * AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA KILLLL MEEEEEEE
 */
client.on("voiceStateUpdate", async (oldState, newState) => {

  if(oldState.channel == newState.channel) return;

  if(channelBecameEmpty(oldState)) {

    if(await isTempChannel(oldState.channel.id)) {

      await removeTempChannel(oldState.channel);

    }

  }

  if(memberLeft(oldState, newState)) {

    if(await isTempChannel(oldState.channel.id) && (oldState.member.voice.mute || oldState.member.voice.deaf)) await unMuteAndUndeafen(oldState.member);

  }

  if(!memberJoined(oldState, newState)) return;

  if(newState.member.voice.mute || newState.member.voice.deaf) {

    if(newState.member.roles.cache.some(role => role.name === "vc_tempMute" || role.name === "vc_tempDeaf")) {
      if(await unMuteAndUndeafen(newState.member)) await removeRoles(newState.member);
    }

  }

  if(!await isCreationChannel(newState.channel)) return;

  await addTempChannel(newState.member, newState.guild);

});




async function isTempChannel(id) {

  return await JSON.parse(fs.readFileSync("./temp_channels.json", { encoding: "utf8" })).includes(id);

}

async function isCreationChannel(channel) {

  if(isNullOrUndefined(channel) || isNullOrUndefined(channel.name)) return false;
  if(fs.readFileSync("./channels.json", { encoding: "utf8" }).length === 0) return false;
  return await JSON.parse(fs.readFileSync("./channels.json", { encoding: "utf8" }))[channel.guild.id].voiceChannel === channel.id;

}

async function addTempChannel(member, guild) {

  var channel = await guild.channels.create({
    name: member.displayName,
    type: ChannelType.GuildVoice,
    parent: await JSON.parse(fs.readFileSync("./channels.json", { encoding: "utf8" }))[guild.id].categoryChannel,
    permissionOverwrites: [
      {
        id: member.user.id,
        allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Administrator]
      },
      {
        id: guild.roles.everyone,
        deny: [PermissionsBitField.Flags.Connect]
      }
    ]
  });

  var removed = false;

  await moveMember(member, channel).catch(() => {
    removeTempChannel(channel);
    removed = true;
  });

  if(channel.members.size < 1) {
    console.log("removing");
    removeTempChannel(channel);
    removed = true;
  }

  if(removed) return;

  const data = await JSON.parse(fs.readFileSync("./temp_channels.json", { encoding: "utf8" }));

  data.push(channel.id);

  fs.writeFileSync("./temp_channels.json", JSON.stringify(data));

}

async function removeTempChannel(channel) {

  if(isNullOrUndefined(channel) || isNullOrUndefined(channel.name)) {
    console.log("fail");
    return;
  }

  if(isNullOrUndefined(deleter.get(channel.guild))) deleter.set(channel.guild, new Deleter());

  await deleter.get(channel.guild).add(channel);

}

function memberJoined(oldState, newState) {

  return newState.channel !== null && typeof(newState.channel) !== typeof(undefined) && oldState.channel !== newState.channel;

}

function memberLeft(oldState, newState) {

  return oldState.channel !== null && typeof(oldState.channel) !== typeof(undefined) && oldState.channel !== newState.channel;

}

function channelBecameEmpty(oldState) {

  return oldState.channel !== null && (oldState.channel.members === null || oldState.channel.members.size < 1);

}

async function moveMember(member, voicechannel) {

  return await member.voice.setChannel(voicechannel);

}

async function unMuteAndUndeafen(member) {

  var success = true;

  await member.voice.setMute(false).catch(async () => {
    await assignRoles(member);
    success = false;
  });
  await member.voice.setDeaf(false).catch(async () => {
    await assignRoles(member);
    success = false;
  });

  return success;

}

async function assignRoles(member) {

  if(!await rolesCreated(member.guild)) await createRoles(member.guild);

  if(member.voice.mute) await member.roles.add(await muteRole.get(member.guild)).catch(reason => console.log("Error trying to apply role to member: " + reason));
  if(member.voice.deaf) await member.roles.add(await deafRole.get(member.guild)).catch(reason => console.log("Error trying to apply role to member: " + reason));

}

async function removeRoles(member) {

  if(!await rolesCreated(member.guild)) return;

  await member.roles.remove(muteRole.get(member.guild)).catch(err => console.log("Error while trying to remove role from member: " + err));
  await member.roles.remove(deafRole.get(member.guild)).catch(err => console.log("Error while trying to remove role from member: " + err));

}

async function createRoles(guild) {

  var failed = false;

  var mute = await guild.roles.create({ name: "vc_tempMute"}).catch(err => {
    console.log("Error while trying to create role 'vc_tempMute': " + err);
    failed = true;
  });
  var deaf = await guild.roles.create({ name: "vc_tempDeaf"}).catch(err => {
    console.log("Error while trying to create role 'vc_tempDeaf': " + err);
    failed = true;
  });

  if(failed) return;

  muteRole.set(guild, mute);
  deafRole.set(guild, deaf);

}

async function rolesCreated(guild) {

  var mute = await (await guild.roles.fetch()).find(role => role.name === "vc_tempMute");
  var deaf = await (await guild.roles.fetch()).find(role => role.name === "vc_tempDeaf");

  muteRole.set(guild, mute);
  deafRole.set(guild, deaf);

  return !isNullOrUndefined(mute) && !isNullOrUndefined(deaf);

}

function isNullOrUndefined(obj) {
  return obj === null || typeof(obj) === typeof(undefined);
}

/**
 * ill reimplement this if channels somehow manage to duplicate
 * // setTimeout()
 */
/*async function check(guild) {

  try {

    await guild.channels.fetch().then(channels => channels.forEach(channel => {

      if(channel.type === ChannelType.GuildVoice && channel.parent !== null && channel.parent.id === categoryChannel) {

        deleter.add(channel);
  
      }
  
    }));

  } catch(error) { console.log("error while trying to check for channels to delete: " + error) }

}*/