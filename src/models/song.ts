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
    const count = await Song.countDocuments().exec();
    const rand = Math.floor(Math.random() * count);
    return (await Song.findOne().skip(rand).exec()).author;
};

export const getQuize = async () => {
    const author = await getAuthor();
    const quizes = await Song.find({ author }).exec();

    const indexes = [];

    if( quizes.length < 4 ) {
        const count = await Song.countDocuments().exec();
        return [
            await Song.findOne().skip( Math.floor(Math.random() * count) ).exec(),
            await Song.findOne().skip( Math.floor(Math.random() * count) ).exec(),
            await Song.findOne().skip( Math.floor(Math.random() * count) ).exec(),
            await Song.findOne().skip( Math.floor(Math.random() * count) ).exec()
        ]
    } else {
        while( indexes.length !== 4 ) {
            const rand = Math.floor(Math.random() * quizes.length);

            if( indexes.includes(rand) ) continue;
            indexes.push(rand);
        }
    }

    return indexes.map( index => quizes[index] );
}