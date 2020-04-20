const Twit = require('twit')
const fetch = require("node-fetch");
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

const tweetIt = async () => {
  let firstResponse = await fetch("https://indonesia-covid-19.mathdro.id/api");
  firstResponse = await firstResponse.json();

  data = {
    jumlahKasus: firstResponse.jumlahKasus,
    meninggal: firstResponse.meninggal,
    sembuh: firstResponse.sembuh,
    perawatan: firstResponse.perawatan
  };

  // declare tweets
  let tweets = [ getFirstTweet(Date.now(), data) ];

  let secondResponse = await fetch(firstResponse.perProvinsi.json);
  secondResponse = await secondResponse.json();

  data.dataProv = secondResponse.data;

  let totalCount = 0;

  for (let iter = 0; iter < data.dataProv.length; iter++){
    data.dataProv[iter].provinsi === 'Indonesia' ? data.dataProv[iter].provinsi = 'Dalam proses verifikasi' : null;
    totalCount += parseInt(data.dataProv[iter].kasusPosi);
    tweets.push(getEachProvinceTweet(data.dataProv[iter]));
  }

  let dataCompare = parseInt(fs.readFileSync("dataCompare.txt"));
  if((data.jumlahKasus == totalCount) && (totalCount != dataCompare)){
      fs.writeFileSync("dataCompare.txt", data.jumlahKasus);
      tweet(tweets[0], tweets)
  }
}

tweetIt()

setInterval(tweetIt, 1000*30)
