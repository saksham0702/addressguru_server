import axios from "axios";
import GoogleListing from "../model/googleListingSchema.js";
import { parseSearchQuery } from "../services/helper.js";
import { FOURSQUARE_API_KEY } from "../services/constant.js";

export const googleSearch = async (req, res) => {
  try {
    const { query, pageToken, category, subCategory } = req.body;

    console.log("REQQ BODYY ::", req?.body);

    // const response = await axios.get(
    //   "https://maps.googleapis.com/maps/api/place/textsearch/json",
    //   {
    //     params: {
    //       query,
    //       key: GOOGLE_API_KEY,
    //       pagetoken: pageToken || "",
    //     },
    //   }
    // );

    const { keyword, location } = parseSearchQuery(query);

    console.log("Keyword:", keyword);
    console.log("Location:", location);

    // const response = await axios.get(
    //   "https://api.foursquare.com/v3/places/search",
    //   {
    //     headers: {
    //       Authorization: FOURSQUARE_API_KEY,
    //       Accept: "application/json",
    //       'X-Places-Api-Version': '1970-01-01',
    //     },
    //     params: {
    //       query: keyword,
    //       near: location || "Delhi, India", // REQUIRED location
    //       limit: 10,
    //     },
    //   },
    // );

    const response = await axios.get(
      "https://places-api.foursquare.com/places/search",
      {
        headers: {
          Authorization: `Bearer ${FOURSQUARE_API_KEY}`,
          accept: "application/json",
          "X-Places-Api-Version": "2025-06-17",
        },
        params: {
          query: keyword,
          near: location || "Delhi",
          limit: 10,
          fields: [
            "fsq_place_id",
            "name",
            "location",
            "geocodes",
            "categories",
            "rating",
            "tel",
            "website",
            "hours",
            "price",
          ].join(","),
        },
      },
    );

    console.log("FOURSQUARE DATA:", response.data);

    // const places = response?.data?.results;
    // const nextPageToken = response?.data?.next_page_token;

    // console.log("GOOFLE PLACESS ::", response?.data);

    // if (!places.length) {
    //   return res.status(404).json({
    //     status: false,
    //     message: "No places found",
    //   });
    // }

    // const detailsPromises = places?.map((place) =>
    //   axios.get("https://maps.googleapis.com/maps/api/place/details/json", {
    //     params: {
    //       place_id: place.place_id,
    //       key: GOOGLE_API_KEY,
    //       fields:
    //         "place_id,international_phone_number,website,name,formatted_address,rating,photos,reviews,user_ratings_total",
    //     },
    //   }),
    // );

    // const detailsResponses = await Promise.all(detailsPromises);

    // const placeDetails = detailsResponses.map((r) => r.data.result);

    // const savePromises = placeDetails.map(async (place) => {
    //   if (!place.place_id) return;

    //   const existing = await GoogleListing.findOne({
    //     placeId: place.place_id,
    //     query,
    //   });

    //   const data = {
    //     placeId: place.place_id,
    //     name: place.name,
    //     address: place.formatted_address,
    //     rating: place.rating || 0,
    //     phoneNumber: place.international_phone_number || "",
    //     website: place.website || "",
    //     totalReviews: place.user_ratings_total || 0,
    //     photos: place.photos || [],
    //     reviews: place.reviews || [],
    //     query,
    //     category,
    //     subCategory,
    //     createdBy: req.user?._id,
    //   };

    //   if (existing) {
    //     await GoogleListing.updateOne({ _id: existing._id }, data);
    //   } else {
    //     await GoogleListing.create(data);
    //   }
    // });

    // await Promise.all(savePromises);

    // console.log("FINALL GOOGLE LISTING DATA ::", placeDetails);

    res.json({
      status: true,
      data: response?.data,
      //   data: placeDetails,
      //   next_page_token: nextPageToken || null,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      status: false,
      message: "Error fetching Google listings",
    });
  }
};
