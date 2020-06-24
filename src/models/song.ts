import * as mongoose from "mongoose";

const { Schema } = mongoose;

export interface iSong {
    title: string,
    author: string,
    album: string,
    src: string,

    full: string,
    link: string,
}

export interface SongDocument extends iSong, mongoose.Document {};

const songSchema = new Schema<iSong>({
    title: { type: String, required: true },
    author: { type: String, required: true },
    album: { type: String, required: true },
    src: { type: String, required: true },
    
    full: { type: String, required: true },
    link: { type: String, required: true },
});

export const Song = mongoose.model<SongDocument>("songs", songSchema);

const getAuthor = async () => {
    return (await Song.aggregate([{ $sample: { size: 1 } }]).exec())[0].author;
};

export const getQuize = async () => {
    const author = await getAuthor();
    const quizes = await Song.find({ author }).exec();

    const indexes = [];

    if( quizes.length < 4 ) {
        return await Song.aggregate([
            { $sample: { size: 4 } }
        ]).exec()
    } else {
        while( indexes.length !== 4 ) {
            const rand = Math.floor(Math.random() * quizes.length);

            if( indexes.includes(rand) ) continue;
            indexes.push(rand);
        }
    }

    return indexes.map( index => quizes[index] );
}