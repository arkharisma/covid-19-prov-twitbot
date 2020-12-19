const Twit = require('twit');
const fetch = require("node-fetch");
const fs = require('fs');
const config = require('./config');
const T = new Twit(config);

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

const getSelisihJumlah = (data, dataCompare) => {
  if (data >= dataCompare) {
    return `+${data - dataCompare}`;
  } else {
    return `-${dataCompare - data}`;
  }
}

const getDataCompareByKodeProv = (kodeProv, dataProv) => {
  let count = 0;
  for (let iter = 0; dataProv.length; iter++){
    if (dataProv[iter].kodeProvi != kodeProv)
      continue;
    else
      return dataProv[iter];
  }
}

const getFirstTweet = (timestamp, data, dataCompare) =>{
    let date_ob = new Date(timestamp)
    let date = date_ob.getDate();
    let month = date_ob.getMonth()+1;
    let year = date_ob.getFullYear();
    return `[${date}/${month}/${year}] Perkembangan data kasus Covid-19 di Indonesia, total: ${data.jumlahKasus} (${getSelisihJumlah(data.jumlahKasus, dataCompare.jumlahKasus)}), dirawat: ${data.perawatan} (${getSelisihJumlah(data.perawatan, dataCompare.perawatan)}), sembuh: ${data.sembuh} (${getSelisihJumlah(data.sembuh, dataCompare.sembuh)}), meninggal: ${data.meninggal} (${getSelisihJumlah(data.meninggal, dataCompare.meninggal)}).`
}

const getEachProvinceTweet = (data, dataCompare) => {
  return `${data.provinsi}, kasus positif: ${data.kasusPosi} (${getSelisihJumlah(data.kasusPosi, dataCompare.kasusPosi)}), kasus sembuh: ${data.kasusSemb} (${getSelisihJumlah(data.kasusSemb, dataCompare.kasusSemb)}), kasus meninggal: ${data.kasusMeni} (${getSelisihJumlah(data.kasusMeni, dataCompare.kasusMeni)}).`;
}

const isJumlahKasusDifferent = (data, dataCompare) => {
  let totalCount = 0;
  for (let iter = 0; iter < data.dataProv.length; iter++){
    totalCount += parseInt(data.dataProv[iter].kasusPosi);
  }

  if (data.jumlahKasus == totalCount && data.jumlahKasus == dataCompare.jumlahKasus)
    return false;
  else if (data.jumlahKasus != totalCount && data.jumlahKasus == dataCompare.jumlahKasus)
    return false;
  else if (data.jumlahKasus == totalCount && data.jumlahKasus != dataCompare.jumlahKasus)
    return true;
}

const writeRecentData = (data) => {
  fs.writeFileSync("recentData.json", JSON.stringify(data), 'utf-8');
}

const tweetIt = async () => {
  let dataTotal = await fetch("https://indonesia-covid-19.mathdro.id/api");
  dataTotal = await dataTotal.json();

  data = {
    jumlahKasus: dataTotal.jumlahKasus,
    meninggal: dataTotal.meninggal,
    sembuh: dataTotal.sembuh,
    perawatan: dataTotal.perawatan
  };

  let dataProv = await fetch(dataTotal.perProvinsi.json);
  dataProv = await dataProv.json();

  data.dataProv = dataProv.data;

  let totalCount = 0;
  for (let iter = 0; iter < data.dataProv.length; iter++){
    totalCount += parseInt(data.dataProv[iter].kasusPosi);
  }

  let dataCompare = JSON.parse(fs.readFileSync("recentData.json", 'utf-8'));

  // declare tweets
  let tweets = [getFirstTweet(Date.now(), data, dataCompare)];

  totalCount = 0;

  for (let iter = 0; iter < data.dataProv.length; iter++){
    data.dataProv[iter].provinsi === 'Indonesia' ? data.dataProv[iter].provinsi = 'Dalam proses verifikasi' : null;
    totalCount += parseInt(data.dataProv[iter].kasusPosi);
    let fid = data.dataProv[iter].kodeProvi;
    tweets.push(getEachProvinceTweet(data.dataProv[iter], getDataCompareByKodeProv(fid, dataCompare.dataProv)));
  }

  if (isJumlahKasusDifferent(data, dataCompare)) {
    writeRecentData(data);
    tweet(tweets[0], tweets);
  }
}

tweetIt()

setInterval(tweetIt, 1000*30)
