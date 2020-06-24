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
        connection: Discord.VoiceConnection,
        voice: Discord.VoiceChannel,
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

// loading from apple music to db
let isLoading: boolean = false;

// create regexp with prefix
const withPrefix = (pattern: string, flags?: string) => new RegExp( "^" + PREFIX + pattern, flags); 


const client = new Discord.Client();
client.on("message", async msg => {
    const { content } = msg;

    // play command
    if( withPrefix("play( \\d)?").test(content) ) {
        try{
            const { id } = msg.member.guild;

            if( !globalState[id] ) {
                const match = content.match(/\d/);
    
                globalState[id] = {
                    isStarted: false,
                    count: match ? Number(match[0]) : 3,
                    voice: msg.member.voice.channel,
                    connection: await msg.member.voice.channel.join(),
                }
            }
    
            if( globalState[id].isStarted ) return msg.reply("game already started!");
    
            globalState[id].isStarted = true;
    
            // get quize
            const quize = await getQuize();
    
            //get random number for right quize
            const random = Math.floor( Math.random() * 4 );
    
            // select quize
            const song = quize[random];
    
            //get read stream from url
            const stream = await getByLink(song.src);
    
            // get voice channel, and voice connection
            const { voice, connection } = globalState[id];
    
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
    
            stream.on("end", () => {
    
                // check reactions
                reactions.then( collected => {
                    // all reactions without bot
                    const arr = [...collected.get(rightEmoji).users.cache].map( ([id, user]) => {
                        if( id === client.user.id ) return "";
                        return `<@${id}>`
                    });
    
                    // edit embed
                    embed.setTitle(song.full);
                    embed.setDescription(arr.join("\n"));
                    embed.setURL(song.link);
                    message.edit(embed);
    
                    // check count 
                    setTimeout( async() => {
                        globalState[id].count--;
    
                        // if count > 0
                        if( globalState[id].count ) {
                            // reset started
                            globalState[id].isStarted = false;
                            
                            // send play command
                            const msg = await message.channel.send(`${PREFIX}play`);
    
                            // delete play command
                            await msg.delete();
                        } else {
    
                            // if count < 0, leave from voice channel
                            voice.leave();
                        }
                    }, 3000 );
                });
            });
    
            stream.on("error", () => {
                // if error leave from voice channel
                voice.leave();
            })
    
    
            // play music intro voice channel
            connection.play( stream );
        } catch(e) {
            const { id } = msg.member.guild;

            msg.reply("error with bot!");

            if( globalState[id] ) {
                globalState[id].voice.leave();
            }
        }
    }

    // add album command
    if( withPrefix("add https://music.apple.com/ru/album.+?").test(content) ) {
        try{
            //regexp for right link
            const regexp = /https:\/\/music.apple.com\/ru\/album\/.+/;

            // if not right
            if( !regexp.test(content) ) return msg.reply("incorrect url!");

            // delete selected song id
            const link = content.match(regexp)[0].replace(/\?i=.*/, "");

            // if already in db
            const inDB = await Song.findOne({ link });

            // if bot loading album to db
            if( isLoading ) return msg.reply("please wait!");
            if( inDB ) return msg.reply("already in db!");

            // start loading
            isLoading = true;

            // wait parse album
            const links = await parseAppleMusic(link);
        
            // create result from parse data
            const result = links.map( ({ src, title: full }) => {
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
        }catch(e) {
            msg.reply("error with bot!");
        }
    }
})

client.on("ready", () => console.log(`Started as ${client.user.tag}`));
preparation().then( () => client.login(TOKEN) );