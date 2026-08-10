import Feature from "../../model/featureSchema.js";
import Category from "../../model/categoriesSchema.js";
import SubCategory from "../../model/subCategoriesSchema.js";

export const buildEmbeddingText = async (listing) => {
  const featureIds = [
    ...(listing.facilities || []),
    ...(listing.services || []),
    ...(listing.courses || []),
  ];

  const [featureDocs, categoryDoc, subCategoryDoc] = await Promise.all([
    featureIds.length
      ? Feature.find({ _id: { $in: featureIds } })
          .select("name type")
          .lean()
      : [],
    listing.category
      ? Category.findById(listing.category).select("name tags").lean()
      : null,
    listing.subCategory
      ? SubCategory.findById(listing.subCategory).select("name").lean()
      : null,
  ]);

  const serviceNames = featureDocs
    .filter((f) => f.type === "service")
    .map((f) => f.name);
  const facilityNames = featureDocs
    .filter((f) => f.type === "facility")
    .map((f) => f.name);
  const courseNames = featureDocs
    .filter((f) => f.type === "course")
    .map((f) => f.name);

  const parts = [
    listing.businessName,
    categoryDoc?.name,
    subCategoryDoc?.name,
    categoryDoc?.tags?.length
      ? `Category tags: ${categoryDoc.tags.join(", ")}`
      : null,
    serviceNames.length ? `Services offered: ${serviceNames.join(", ")}` : null,
    facilityNames.length ? `Facilities: ${facilityNames.join(", ")}` : null,
    courseNames.length ? `Courses: ${courseNames.join(", ")}` : null,
    listing.description,
    listing.businessAddress,
    listing.cityNameLower,
  ].filter(Boolean);

  return parts.join(". ");
};

export default buildEmbeddingText;
