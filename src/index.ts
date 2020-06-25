import * as Discord from "discord.js";
import * as dotenv from "dotenv";
import * as mongoose from "mongoose";
import { getByLink } from "./getByLink";
import { Song, getQuize } from "./models/song";
import { parseAppleMusic } from "./parseAppleMusic";
 
// .env config
dotenv.config();
// data from config
const { TOKEN, PREFIX, MONGO_URI } = process.env;

interface GlobalState {
    [id: string]: {
        count: number,
        isStarted: boolean,
        isSkiped: boolean,

        connection: Discord.VoiceConnection,
        voice: Discord.VoiceChannel,
        stream: Discord.StreamDispatcher | null,
    }
}
// app state
const globalState: GlobalState = {};

const preparation = async() => await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// list of emoji
const emoji = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];

// list of commands;
const commands = {
    play: `${PREFIX}play`,
    skip: `${PREFIX}skip`,
    stop: `${PREFIX}stop`,
    add: `${PREFIX}add`,
}

// loading from apple music to db
let isLoading: boolean = false;

// music error handler
const errorHandler = (msg: Discord.Message, e: Error) => {
    const { id } = msg.member.guild;

    msg.reply("error with bot!");
    console.error(e);

    if( globalState[id] ) {
        globalState[id].voice.leave();

        delete globalState[id];
    }
}

const client = new Discord.Client();

// play command
client.on("message", async msg => {
    const { content } = msg;

    // if not play command
    if( !new RegExp(`${commands.play}( \\d+)?`).test(content) ) return;

    try{
        const { id } = msg.member.guild;

        if( !globalState[id] ) {
            const match = content.match(/\d+/);

            globalState[id] = {
                isStarted: false,
                isSkiped: false,
                count: match ? Number(match[0]) : 3,

                voice: msg.member.voice.channel,
                connection: await msg.member.voice.channel.join(),
                stream: null,
            }
        }

        const state = globalState[id];

        if( state.isStarted ) return msg.reply("game already started!");

        state.isStarted = true;

        // get quize
        const quize = await getQuize();

        // get random number for right quize
        const random = Math.floor( Math.random() * 4 );

        // select right quize
        const song = quize[random];

        // get read stream from url
        const stream = await getByLink(song.src);

        // get voice channel, and voice connection
        const { voice, connection } = state;

        // create embed msg
        const embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle(song.author)
            .setFooter("powered by apple music!")
            .setDescription(quize.map( ({title}, index) => emoji[index] + "\t\t" + title ).join("\n \n"))
            .setTimestamp()

        // get link to embed message
        const message = await msg.channel.send(embed);

        // pick right emoji
        const rightEmoji = emoji[random];

        // add react to message
        emoji.forEach( emo => {
            message.react(emo);
        } );

        // wait all reactions
        const reactions = message.awaitReactions(() => true, { time: 28000 });

        // check count 
        const checkCount = () => setTimeout( async() => {
            state.count--;

            // if count > 0
            if( state.count ) {
                // reset started
                state.isStarted = false;

                // reset skiped
                state.isSkiped = false;
                
                // send play command
                const msg = await message.channel.send(commands.play);

                // delete play command
                await msg.delete();
            } else {

                // if count < 0, delete state, and leave from voice channel
                delete globalState[id];
                voice.leave();
            }
        }, 3000 );


        // edit message
        const editMessage = (extra: string = "") => {
            embed.setTitle(song.full);
            embed.setDescription(rightEmoji + "\t\t" + song.title + "\n\n" + extra);
            embed.setURL(song.link);
            message.edit(embed);
        }

        // adding stream 
        state.stream = connection.play( stream )
            .on("finish", () => {

                if( state.isSkiped ) {
                    editMessage("skiped!")
                    checkCount();
                    return;
                }

                // check reactions
                reactions.then( collected => {

                    // create notifications for users
                    const arr = [...collected.get(rightEmoji).users.cache].map( ([id, user]) => {
                        if( id === client.user.id ) return "";
                        return `<@${id}>`
                    });

                    // view result
                    editMessage(arr.join(""));

                    // check count 
                    checkCount();
                });
            })
            .on("error", () => {
                // if error leave from voice channel
                voice.leave();
            })

    } catch(e) {
        errorHandler(msg, e)
    }
});

// add command
client.on("message", async msg => {
    const { content } = msg;

    // if not add album command
    if( !new RegExp(`${commands.add} https://music.apple.com/.+?/album.+?`).test(content) ) return;

    try {
        //regexp for right link
        const regexp = /https:\/\/music.apple.com\/.+?\/album\/(.+)/;

        // if not right
        if( !regexp.test(content) ) return msg.reply("incorrect url!");

        const match = content.match(regexp);

        // delete selected song id
        const link = match[0].replace(/\?i=.*/, "");

        // if already in db
        const inDB = await Song.findOne({ link: { $regex: new RegExp(`https:\/\/music.apple.com\/.+?\/album\/${match[1]}`) } });

        // if bot loading album to db
        if( isLoading ) return msg.reply("please wait!");
        if( inDB ) return msg.reply("already in db!");

        // start loading
        isLoading = true;

        // wait parse album
        const links = await parseAppleMusic(link);
    
        // create result from parse data
        const result = links.map( ({ src, title: full }) => {

            // full have "title - author - album" type
            const splited = full.split(" - ");
        
            const [title, author] = splited;
            let album = splited[2];
        
            if( splited[3] ) album += " - " + splited[3];
    
            return { title, author, album, src, full, link };
        } );

        // insert all result into db
        await Song.insertMany(result);

        // answer
        msg.reply("success");

        // set loading off
        isLoading = false;
    } catch(e) {
        msg.reply("error with adding to db!");
        console.error(e);
    }
});

// skip command
client.on("message", async msg => {
    const { content } = msg;

    // if not skip command
    if( !new RegExp(commands.skip).test(content) ) return;

    try {
        const { id } = msg.member.guild;

        if( !globalState[id] ) return;

        // set skiped 
        globalState[id].isSkiped = true;

        // invoke finish event
        globalState[id].stream?.end();
    } catch (e) {
        errorHandler(msg, e);
    }
});

// stop command
client.on("message", async msg => {
    const { content } = msg;

    // if not stop command
    if( !new RegExp(commands.stop).test(content) ) return;

    try {
        const { id } = msg.member.guild;

        const state = globalState[id];

        if( !state ) return;

        // set state for skip command
        state.count = 1;
        const message = await msg.channel.send(commands.skip);
        await message.delete();
    } catch (e) {
        errorHandler(msg, e);
    }
});

client.on("ready", () => console.log(`Started as ${client.user.tag}`));
preparation().then( () => client.login(TOKEN) );