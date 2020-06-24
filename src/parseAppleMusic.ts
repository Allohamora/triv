import * as puppeteer from "puppeteer";

export const parseAppleMusic = async(link: string): Promise<{ title: string, src: string }[]> => {
    const browser = await puppeteer.launch({
        // headless: false, 
    });

    try {
        const page = await browser.newPage();

        await page.goto(link);

        // wait redirect
        await new Promise(res => setTimeout(res, 5000));

        // wait links
        await page.waitForSelector(".play-button.is-list-item");

        const data = await page.evaluate( async () => {
            const result = [];

            const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".play-button"));

            // need for create music-player
            buttons[1].click();
            await new Promise(res => setTimeout(res, 3000));

            const player = document.querySelector("#apple-music-player");
            player.addEventListener("play", e => {
                // i don't know how fix this
                const target = e.target as any;
                
                result.push({ title: target.title as string, src: target.src as string })
            });

            await buttons.reduce( (chain, button) => chain.then( async () => {
                button.click();

                await new Promise(res => setTimeout(res, 2000));

                button.click();
                return;
            } ), Promise.resolve() );

            return result;
        } )

        await browser.close();
        return data;
    } catch(e) {
        console.error(e);
        await browser.close();
    }
}