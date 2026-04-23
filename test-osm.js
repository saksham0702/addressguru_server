import axios from 'axios';

async function test() {
  try {
    const res = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: {
        q: "restaurants in Dubai",
        format: "json",
        addressdetails: 1,
        extratags: 1,
        limit: 10
      },
      headers: {
        'User-Agent': 'AddressGuruApp/1.0'
      }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.message);
  }
}
// test();
