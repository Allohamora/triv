import * as Discord from "discord.js";
import * as dotenv from "dotenv";
import * as mongoose from "mongoose";
import { getByLink } from "./getByLink";
import { Song, iSong } from "./models/song";
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

let isLoading: boolean = false;

const withPrefix = (pattern: string, flags?: string) => new RegExp( "^" + PREFIX + pattern, flags); 
const client = new Discord.Client();
client.on("message", async msg => {
    const { content } = msg;

    // play command
    if( withPrefix("play").test(content) ) {
        const voice =  msg.member.voice.channel;
        const song = await Song.findOne().skip(25).exec();
        const stream = await getByLink(song.src);
        const joined = await voice.join();

        stream.on("end", () => {
            voice.leave();
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