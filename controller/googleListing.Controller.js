import axios from "axios";
import GoogleListing from "../model/googleListingSchema.js";
import { parseSearchQuery } from "../services/helper.js";
import { FOURSQUARE_API_KEY } from "../services/constant.js";

// Helper: Google photo URL
const getPhotoUrl = (ref) => {
  if (!ref) return "";
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${GOOGLE_API_KEY}`;
};

export const googleSearch = async (req, res) => {
  try {
    const {
      query,
      pageToken,
      category,
      subCategory,
      withDetails = false,
      useGoogle = false, // 🔥 switch
    } = req.body;

    console.log("REQ BODY ::", req.body);

    let placeDetails = [];

    // =========================
    // 🔵 GOOGLE FLOW
    // =========================
    if (useGoogle) {
      const searchRes = await axios.get(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        {
          params: {
            query,
            key: GOOGLE_API_KEY,
            pagetoken: pageToken || "",
          },
        }
      );

      let results = searchRes.data.results || [];
      results = results.slice(0, 10); // limit 10

      placeDetails = results.map((place) => ({
        place_id: place.place_id,
        name: place.name,
        formatted_address: place.formatted_address,
        rating: place.rating || 0,
        user_ratings_total: place.user_ratings_total || 0,
        lat: place.geometry?.location?.lat,
        lon: place.geometry?.location?.lng,
        international_phone_number: "",
        website: "",
        photos: place.photos?.length
          ? place.photos.map((p) => getPhotoUrl(p.photo_reference))
          : [],
        reviews: [],
      }));

      // 🔥 DETAILS API (optional)
      if (withDetails) {
        placeDetails = await Promise.all(
          placeDetails.map(async (place) => {
            try {
              const detailsRes = await axios.get(
                "https://maps.googleapis.com/maps/api/place/details/json",
                {
                  params: {
                    place_id: place.place_id,
                    key: GOOGLE_API_KEY,
                    fields:
                      "international_phone_number,website,reviews",
                  },
                }
              );

              const d = detailsRes.data.result;

              return {
                ...place,
                international_phone_number:
                  d?.international_phone_number || "",
                website: d?.website || "",
                reviews: d?.reviews || [],
              };
            } catch (err) {
              console.log("Details error:", err.message);
              return place;
            }
          })
        );
      }
    }

    // =========================
    // 🟢 FREE OSM FLOW (YOUR ORIGINAL)
    // =========================
    else {
      const { keyword, location } = parseSearchQuery(query);

      const response = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          params: {
            q: `${keyword} ${location ? "in " + location : ""}`,
            format: "json",
            addressdetails: 1,
            extratags: 1,
            limit: 10,
          },
          headers: {
            "User-Agent": "AddressGuruUAE/1.0",
          },
        }
      );

      const places = response.data;

      placeDetails = places.map((place, index) => {
        const mockRating = parseFloat(
          (Math.random() * (5.0 - 3.5) + 3.5).toFixed(1)
        );
        const mockReviewsCount = Math.floor(Math.random() * 200) + 10;

        let site =
          place.extratags?.website ||
          place.extratags?.["contact:website"] ||
          "";

        const genericPhotos = [
          `https://picsum.photos/seed/${place.place_id}_1/800/600`,
          `https://picsum.photos/seed/${place.place_id}_2/800/600`,
        ];

        return {
          place_id: place.place_id.toString(),
          name:
            place.name ||
            place.address?.amenity ||
            "Business Listing",
          formatted_address: place.display_name,
          rating: mockRating,
          international_phone_number:
            place.extratags?.phone ||
            place.extratags?.["contact:phone"] ||
            "",
          website: site,
          user_ratings_total: mockReviewsCount,
          photos: genericPhotos,
          reviews: [],
          lat: place.lat,
          lon: place.lon,
        };
      });
    }

    // =========================
    // 💾 SAVE (UNCHANGED)
    // =========================
    const savePromises = placeDetails.map(async (place) => {
      if (!place.place_id) return;

      const existing = await GoogleListing.findOne({
        placeId: place.place_id,
        query,
      });

      const data = {
        placeId: place.place_id,
        name: place.name,
        address: place.formatted_address,
        rating: place.rating || 0,
        phoneNumber: place.international_phone_number || "",
        website: place.website || "",
        totalReviews: place.user_ratings_total || 0,
        photos: place.photos || [],
        reviews: place.reviews || [],
        query,
        category,
        subCategory,
        createdBy: req.user?._id,
      };

      if (existing) {
        await GoogleListing.updateOne({ _id: existing._id }, data);
      } else {
        await GoogleListing.create(data);
      }
    });

    await Promise.all(savePromises);

    // =========================
    // ✅ RESPONSE
    // =========================
    res.json({
      status: true,
      data: {
        results: placeDetails,
      },
    });
  } catch (error) {
    console.log("ERROR:", error?.response?.data || error.message);

    res.status(500).json({
      status: false,
      message: "Error fetching listings",
    });
  }
};