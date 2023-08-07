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

    //console.log("duplicate? " + this.list.includes(channel));

    if(this.list.includes(channel)) return;

    this.list.push(channel);

    //console.log("list size: " + this.list.length + ", " + this.list[0].id);
    
    await this.start();
 
  }

  remove(index) {

    this.list.splice(index, 1);

    if(this.list.length < 1) this.deleting = false;

  }

  async start() {

    //console.log("deleting? " + this.deleting);

    if(this.deleting) return;

    this.deleting = true;

    //console.log("starting deletion");

    for(var index = 0; index < this.list.length; index++) {

      const vc = this.list[0];

      //console.log("looking at " + vc.id);
      
      if(!await isTempChannel(vc.id)) {
          
        try {

          //console.log("deleting " + channel.id);
          vc.delete().finally(() => {
            this.remove(0);
          });

        } catch(err) {

          this.remove(0);
          //console.log("error while tryin to delete corrupt channel: " + err);

        }

      }

      if(vc.members === null || typeof(vc.members) === typeof(undefined) || vc.members.size < 1) {

        try {

          //console.log("deleting " + vc.id);
          var id = vc.id;
          vc.delete().then(async () => {
            const data = await JSON.parse(fs.readFileSync("./temp_channels.json", { encoding: "utf8" }));
            data.splice(data.indexOf(id), 1);
            fs.writeFileSync("./temp_channels.json", JSON.stringify(data));
            
          }).finally(() => {
            this.remove(0);
          });

        } catch(err) {

          this.remove(0);
          //console.log("error while tryin to delete corrupt channel: " + err);

        }

      }

      if((index - 1) === this.list.length && this.deleting) this.deleting = false;

    }

  }

}


const { Client, IntentsBitField, PermissionsBitField, ChannelType, NewsChannel, GuildMemberFlags, Colors} = require('discord.js');
const { token } = require('./token.json');
const deleter = new Map(); // map<guildID, Deleter>
const muteRole = new Map(); // map<guidID, role>
const deafRole = new Map(); // map<guidID, role>
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

  var vc = null;
  var gc = null;

  const msg = message;

  await msg.guild.channels.fetch(args[0]).then(async (channel) => {

    vc = channel;

    await msg.guild.channels.fetch(args[1]).then(async (category) => {

      cg = category;

      if(fs.readFileSync("./channels.json", {encoding: 'utf8'}).length === 0) {

        fs.writeFileSync("./channels.json", JSON.stringify(createChannelData(msg.guildId, args[0], args[1])));
        msg.reply("Join-Channel set to: " + (!isNullOrUndefined(vc) ? vc.name : args[0]) + ".\n" + "Category set to: " + (!isNullOrUndefined(cg) ? cg.name : args[1]) + ".");
        return;

      }

      var data = await JSON.parse(fs.readFileSync("./channels.json", {encoding: 'utf8'}));

      data[msg.guildId].voiceChannel = args[0];
      data[msg.guildId].categoryChannel = args[1];

      fs.writeFileSync("./channels.json", JSON.stringify(data));

      }).then(async () => {
        msg.reply("Join-Channel set to: " + (!isNullOrUndefined(vc) ? vc.name : args[0]) + ".\n" + "Category set to: " + (!isNullOrUndefined(cg) ? cg.name : args[1]) + ".");
      }).catch((reason) => msg.reply("Could not find a category with id '" + args[1] + "'! " + reason));

  }).catch((reason) => msg.reply("Could not find a channel with id '" + args[0] + "'! " + reason));

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

  //console.log("something happened");

  //console.log("member " + (memberLeft(oldState, newState) ? "left" : "joined"));

  if(channelBecameEmpty(oldState)) {

    //console.log("channel became empty");

    if(await isTempChannel(oldState.channel.id)) {
      //console.log("channel is temp");
      await removeTempChannel(oldState.channel);
      
      //console.log("removed temp channel");
    }

  }

  if(memberLeft(oldState, newState)) {

    //console.log("istemp? " + isTempChannel(oldState.channel.id));

    if(await isTempChannel(oldState.channel.id) && (oldState.member.voice.mute || oldState.member.voice.deaf)) await unMuteAndUndeafen(oldState.member);

  }

  if(!memberJoined(oldState, newState)) return;

  //console.log(newState.member.displayName + " joined " + newState.channel.name);

  //console.log("member joined a channel");

  if(newState.member.voice.mute || newState.member.voice.deaf) {

    if(newState.member.roles.cache.some(role => role.name === "vc_tempMute" || role.name === "vc_tempDeaf")) {
      await unMuteAndUndeafen(newState.member).then(async () => await removeRoles(newState.member));
    }

  }

  if(!await isCreationChannel(newState.channel)) return;

  await addTempChannel(newState.member, newState.guild);

  //console.log("created new temp channel");

});




async function isTempChannel(id) {

  //console.log("istemp?" + await JSON.parse(fs.readFileSync("./temp_channels.json", { encoding: "utf8" })).includes(id));

  return await JSON.parse(fs.readFileSync("./temp_channels.json", { encoding: "utf8" })).includes(id);

}

async function isCreationChannel(channel) {

  //console.log("iscreation?" + (await JSON.parse(fs.readFileSync("./channels.json", { encoding: "utf8" }))[channel.guild.id].voiceChannel === channel.id));

  if(fs.readFileSync("./channels.json", { encoding: "utf8" }).length === 0) return false;
  return await JSON.parse(fs.readFileSync("./channels.json", { encoding: "utf8" }))[channel.guild.id].voiceChannel === channel.id;

}

async function addTempChannel(member, guild) {

  await guild.channels.create({
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
  }).then(async vc => {

    var removed = false;

    await moveMember(member, vc).catch(() => {
      removeTempChannel(vc)
      removed = true;
    });

    if(removed) return;

    const data = await JSON.parse(fs.readFileSync("./temp_channels.json", { encoding: "utf8" }));

    data.push(vc.id);

    fs.writeFileSync("./temp_channels.json", JSON.stringify(data));
    
  });

}

async function removeTempChannel(channel) {

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

  await member.voice.setMute(false)
    .then(async () => await member.voice.setDeaf(false))
    .catch(async () => await assignRoles(member));

}

async function assignRoles(member) {

  await rolesCreated(member.guild).then(async (roles) => {

    if(roles === false) {

      await createRoles(member.guild).then(async () => {

        //console.log(muteRole.get(member.guild).name);
        //console.log(deafRole.get(member.guild).name);

        if(member.voice.mute) await member.roles.add(await muteRole.get(member.guild)).catch(reason => console.log("Error trying to apply new role to member: " + reason));
        if(member.voice.deaf) await member.roles.add(await deafRole.get(member.guild)).catch(reason => console.log("Error trying to apply new role to member: " + reason));
  
      }).catch(err => console.log("Error while creating roles: " + err));

      return;

    }

    var mute = roles[0];
    var deaf = roles[1];

    if(mute !== muteRole.get(member.guild)) muteRole.set(member.guild, mute);
    if(deaf !== deafRole.get(member.guild)) deafRole.set(member.guild, deaf);

    if(member.voice.mute) await member.roles.add(await muteRole.get(member.guild)).catch(reason => console.log("Error trying to apply role to member: " + reason));
    if(member.voice.deaf) await member.roles.add(await deafRole.get(member.guild)).catch(reason => console.log("Error trying to apply role to member: " + reason));

  }).catch(err => console.log("Error while trying to check if roles were created: " + err));

}

async function removeRoles(member) {

  await rolesCreated(member.guild).then(async (created) => {

    if(!created) return;

    await member.roles.remove(muteRole.get(member.guild)).catch(err => console.log("Error while trying to remove role from member: " + err));
    await member.roles.remove(deafRole.get(member.guild)).catch(err => console.log("Error while trying to remove role from member: " + err));

  })

}

async function createRoles(guild) {
  return await new Promise(async (resolve, reject) => {

    await guild.roles.create({ name: "vc_tempMute"})
      .then(async (mute) => {
        muteRole.set(guild, await mute);
        //console.log("success: " + muteRole.get(guild).name);
      })
      .then(await guild.roles.create({ name: "vc_tempDeaf"})
        .then(async (deaf) => {
          deafRole.set(guild, await deaf);
          //console.log("success: " + deafRole.get(guild).name);
        })
        .then(async () => resolve([await muteRole.get(guild), await deafRole.get(guild)]))
        .catch(err => {
          console.log("Error while trying to create role 'vc_tempDeaf': " + err);
          reject(err);
        }))
      .catch(err => {
        console.log("Error while trying to create role 'vc_tempMute': " + err);
        reject(err);
      });

  });
}

async function rolesCreated(guild) {
  
  return await new Promise(async (resolve, reject) => {

    var mute = (await guild.roles.fetch()).find(role => role.name === "vc_tempMute");
    var deaf = (await guild.roles.fetch()).find(role => role.name === "vc_tempDeaf");

    muteRole.set(guild, await mute);
    deafRole.set(guild, await deaf);

    resolve(!isNullOrUndefined(await mute) && !isNullOrUndefined(await deaf) ? [await mute, await deaf] : false);

  });

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