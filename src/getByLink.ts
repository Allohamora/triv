import * as https from "https";
import * as stream from "stream";
import { PassThrough } from "stream";

export const getByLink = (url: string) => new Promise<stream.Readable>((res, rej) => {
    try{
        https.get(url, response => {
            const buffer = new PassThrough();
            response.pipe(buffer);
            res(stream.Readable.from(buffer));
        });
    } catch(e) {
        throw e;
        // rej(e);
    }
});