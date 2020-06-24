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