const Twit = require('twit')
const https = require("https");
const fs = require('fs')
const config = require('./config')
const T = new Twit(config)

let post_promise = require('util').promisify( // Wrap post function w/ promisify to allow for sequential posting.
    (options, data, cb) => T.post(
      options,
      data,
      (err, ...results) => cb(err, results)
    )
);

// Async/await for the results of the previous post, get the id...
const tweet_crafter = async (array, id) => { 
    for(let i = 1; i < array.length; i++){
        let content = await post_promise('statuses/update', { status: array[i], in_reply_to_status_id: id });
        id = content[0].id_str;
    };
};

const tweet = (first, subsequent) => { 
    post_promise('statuses/update', { status: `${first}` })
        .then((top_tweet) => {
            console.log(`${top_tweet[0].text} tweeted!`);
            let starting_id = top_tweet[0].id_str; // Get top-line tweet ID...
            tweet_crafter(subsequent, starting_id);
        })
        .catch(err => console.log(err));
};

const getFirstTweet = (timestamp, data) =>{
    let date_ob = new Date(timestamp)
    let date = date_ob.getDate();
    let month = date_ob.getMonth()+1;
    let year = date_ob.getFullYear();
    return `[${date}/${month}/${year}] Perkembangan data kasus Covid-19 di Indonesia, total: ${data.jumlahKasus}, dirawat: ${data.perawatan}, sembuh: ${data.sembuh}, meninggal: ${data.meninggal}.`
}

const getEachProvinceTweet = (data) => {
    return `${data.provinsi}, kasus positif: ${data.kasusPosi}, kasus sembuh: ${data.kasusSemb}, kasus meninggal: ${data.kasusMeni}.`
}

const tweetIt = () => {
    const url = "https://indonesia-covid-19.mathdro.id/api";
    const urlProv = "https://indonesia-covid-19.mathdro.id/api/provinsi";

    https.get(url, res => {
        res.setEncoding("utf8");
        let body = "";
        res.on("data", data => {
            body += data;
        });
        res.on("end", () => {
            body = JSON.parse(body);
            const dataAPI = {
                jumlahKasus: body.jumlahKasus,
                meninggal: body.meninggal,
                sembuh: body.sembuh,
                perawatan: body.perawatan
            }
            https.get(urlProv, res => {
                res.setEncoding("utf8");
                let body = "";
                res.on("data", data => {
                    body += data;
                });
                res.on("end", () => {
                    body = JSON.parse(body);
                    dataAPI.dataProv = body.data
    
                    // Making timestamp
                    let ts = Date.now()

                    // Making tweets
                    let tweets = [
                        getFirstTweet(ts, dataAPI)
                    ]

                    let totalCount = 0;

                    dataAPI.dataProv.forEach(element => {
                        totalCount += parseInt(element.kasusPosi)
                        let tweet = getEachProvinceTweet(element)
                        tweets.push(tweet)
                    });

                    let dataCompare = parseInt(fs.readFileSync("dataCompare.txt"))
                    if((dataAPI.jumlahKasus == totalCount) && (totalCount != dataCompare)){
                        fs.writeFileSync("dataCompare.txt", dataAPI.jumlahKasus)
                        tweet(tweets[0], tweets)
                    }
                });
            });
        });
    });
};

tweetIt()

setInterval(tweetIt, 1000*30)