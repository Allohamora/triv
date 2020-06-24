import * as Discord from "discord.js";
import * as dotenv from "dotenv";
import * as mongoose from "mongoose";
import { getByLink } from "./getByLink";
import { Song, iSong, SongDocument, getQuize } from "./models/song";
import { parseAppleMusic } from "./parseAppleMusic";
 
dotenv.config();
const { TOKEN, PREFIX, MONGO_URI } = process.env;

interface GlobalState {
    [id: string]: {
        index: number,
        songs: iSong[],
    }
}
const globalState: GlobalState = {};

const preparation = async() => await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const emoji = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];
let isLoading: boolean = false;

const withPrefix = (pattern: string, flags?: string) => new RegExp( "^" + PREFIX + pattern, flags); 
const client = new Discord.Client();
client.on("message", async msg => {
    const { content } = msg;

    // play command
    if( withPrefix("play").test(content) ) {
        const voice =  msg.member.voice.channel;
        const { id } = msg.member.guild;

        if( globalState[id] ) return msg.reply("game already started!");

        const quize = await getQuize();

        const random = Math.floor( Math.random() * 4 );
        const song = quize[random];
        const stream = await getByLink(song.src);
        const joined = await voice.join();

        const embed = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(song.author)
        .setFooter("powered by apple music!")
        .setDescription(quize.map( ({title}, index) => emoji[index] + "\t\t" + title ).join("\n \n"))
        .setTimestamp()

        const message = await msg.channel.send(embed);
        const rightEmoji = emoji[random];
        emoji.forEach( emo => {
            message.react(emo);
        } );

        const reactions = message.awaitReactions(() => true, { time: 28000 });

        stream.on("end", () => {
            voice.leave();
            reactions.then( collected => {
                const arr = [...collected.get(rightEmoji).users.cache].map( ([id, user]) => {
                    if( id === client.user.id ) return "";
                    return `<@${id}>`
                });

                embed.setTitle(song.full);
                embed.setDescription(arr.join("\n"));
                embed.setURL(song.link);
                message.edit(embed);
            });
        });

        stream.on("error", () => {
            voice.leave();
        })

       joined.play( stream );
    }

    // add command
    if( withPrefix("add https://music.apple.com/ru/album.+?").test(content) ) {
        const regexp = /https:\/\/music.apple.com\/ru\/album\/.+/;

        if( !regexp.test(content) ) return msg.reply("incorrect url!");

        const link = content.match(regexp)[0].replace(/\?i=.*/, "");
        const inDB = await Song.findOne({ link });

        if( isLoading ) return msg.reply("please wait!");
        if( inDB ) return msg.reply("already in db!");

        isLoading = true;
        const links = await parseAppleMusic(link);
    
        const result = links.map( ({ src, title: full }) => {
            const splited = full.split(" - ");
        
            const [title, author] = splited;
            let album = splited[2];
        
            if( splited[3] ) album += " - " + splited[3];
    
            return { title, author, album, src, full, link };
        } );

        await Song.insertMany(result);
        msg.reply("success");
        isLoading = false;
    }
})

client.on("ready", () => console.log(`Started as ${client.user.tag}`));
preparation().then( () => client.login(TOKEN) );