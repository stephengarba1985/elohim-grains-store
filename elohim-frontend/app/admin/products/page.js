"use client";

import { useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

const STATIC_GRAIN_ASSET_PATHS = {
  "abakaliki rice": "/grains/Abakaliki Rice.jpg",
  "ofada rice": "/grains/Ofada rice.jfif",
  "beans-(oloyin)": "/grains/beans-(oloyin).jpg",
  "beans": "/grains/beans.jpg",
  "chia-seeds": "/grains/chia-seeds.jpg",
  "cowpea": "/grains/cowpea.jpg",
  "garri": "/grains/garri.jpg",
  "groundnut": "/grains/groundnut.jpg",
  "kidney-beans": "/grains/kidney-beans.jpg",
  "local-rice": "/grains/local-rice.jpg",
  "maize": "/grains/maize.jpg",
  "millet": "/grains/millet.jpg",
  "ogbono": "/grains/ogbono.jpg",
  "pigeon pea": "/grains/Pigeon Pea.jpg",
  "pigeon-pea": "/grains/Pigeon Pea.jpg",
  "plantain-flour": "/grains/plantain-flour.jpg",
  "rice": "/grains/rice.jpg",
  "sorghum": "/grains/sorghum.jpg",
  "soybeans": "/grains/soybeans.jpg",
  "wheat": "/grains/wheat.jpg",
  "yam-flour(amala)": "/grains/yam-flour(amala).jpg",
};

const normalizeGrainNameKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/[-]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildImageNameVariants = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return [];

  const normalized = normalizeGrainNameKey(raw);
  if (!normalized) return [];

  const tokens = normalized.split(" ").filter(Boolean);
  const title = tokens
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const variants = [
    raw,
    raw.replace(/[_]+/g, " "),
    raw.replace(/[-]+/g, " "),
    raw.replace(/[()]/g, " "),
    normalized,
    normalized.replace(/\s+/g, "-"),
    normalized.replace(/\s+/g, "_"),
    normalized.replace(/\s+/g, ""),
    title,
    title.replace(/\s+/g, "-"),
    title.replace(/\s+/g, "_"),
    title.replace(/\s+/g, ""),
    tokens.join(""),
    tokens.join("-"),
    tokens.join("_"),
  ];

  return Array.from(new Set(variants)).filter(Boolean);
};

const buildImageCandidatesFromName = (value) => {
  const variants = buildImageNameVariants(value);
  const extensions = [".jpg", ".jpeg", ".png", ".jfif", ".webp"];
  const candidates = [];

  variants.forEach((variant) => {
    const withSpaces = String(variant).trim();
    const withDashes = withSpaces.replace(/\s+/g, "-");
    const withUnderscore = withSpaces.replace(/\s+/g, "_");
    const compact = withSpaces.replace(/\s+/g, "");

    [withSpaces, withDashes, withUnderscore, compact].forEach((name) => {
      if (!name) return;
      extensions.forEach((ext) => {
        candidates.push(`/grains/${name}${ext}`);
      });
    });
  });

  return Array.from(new Set(candidates));
};

const getStaticGrainAssetMatch = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const normalized = normalizeGrainNameKey(raw);
  if (!normalized) return null;

  const lookupMap = new Map(
    Object.entries(STATIC_GRAIN_ASSET_PATHS).map(([key, path]) => [
      normalizeGrainNameKey(key),
      path,
    ])
  );

  const candidates = Array.from(
    new Set([
      ...buildImageNameVariants(raw),
      ...buildImageNameVariants(normalized),
      normalized,
      normalized.replace(/\s+/g, "-"),
      normalized.replace(/\s+/g, "_"),
      normalized.replace(/\s+/g, ""),
    ])
  );

  for (const candidate of candidates) {
    const key = normalizeGrainNameKey(candidate);
    if (lookupMap.has(key)) return lookupMap.get(key);
    if (lookupMap.has(key.replace(/\s+/g, "-"))) {
      return lookupMap.get(key.replace(/\s+/g, "-"));
    }
    if (lookupMap.has(key.replace(/\s+/g, "_"))) {
      return lookupMap.get(key.replace(/\s+/g, "_"));
    }
  }

  const tokens = normalized.split(" ").filter(Boolean);
  for (const [key, path] of Object.entries(STATIC_GRAIN_ASSET_PATHS)) {
    const staticTokens = normalizeGrainNameKey(key).split(" ").filter(Boolean);
    if (
      tokens.length > 0 &&
      staticTokens.length > 0 &&
      tokens.every((token) => staticTokens.includes(token))
    ) {
      return path;
    }
  }

  return null;
};

const emptyProduct = {
  name: "",
  description: "",
  category_id: "",
  image_url: "",
};

const emptyType = {
  product_id: "",
  name: "",
  origin: "",
  brand: "",
  description: "",
  image: "",
};

const emptyVariant = {
  product_type_id: "",
  weight: "",
  price: "",
  stock: "",
  image: "",
};

const emptyVariantUpdate = {
  price: "",
  add_stock: "",
};

const emptyCategory = {
  name: "",
  slug: "",
  description: "",
  image: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allProductTypes, setAllProductTypes] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [productVariants, setProductVariants] = useState([]);
  const [unassignedVariants, setUnassignedVariants] = useState([]);

  const [loading, setLoading] = useState(false);
  const [uploadingCategoryImage, setUploadingCategoryImage] = useState(false);

  const [showProductForm, setShowProductForm] = useState(false);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const [productForm, setProductForm] = useState(emptyProduct);
  const [typeForm, setTypeForm] = useState(emptyType);
  const [variantForm, setVariantForm] = useState(emptyVariant);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);

  const [editingProductId, setEditingProductId] = useState(null);
  const [editingTypeId, setEditingTypeId] = useState(null);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [expandedProducts, setExpandedProducts] = useState({});
  const [assigningVariant, setAssigningVariant] = useState(null);
  const [assignTypeId, setAssignTypeId] = useState("");
  const [editingVariant, setEditingVariant] = useState(null);
  const [variantUpdateForm, setVariantUpdateForm] = useState(emptyVariantUpdate);

  /* =========================
     IMAGE HELPERS
  ========================= */

  const getBackendRootUrl = () => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:5000/api";

    return apiUrl.replace(/\/api\/?$/, "");
  };

  const getImageCandidateList = (productName) => {
    const candidates = [];
    const addCandidate = (candidate) => {
      const value = String(candidate || "").trim();
      if (!value || candidates.includes(value)) return;
      candidates.push(value);
    };

    const staticMatch = getStaticGrainAssetMatch(productName);
    if (staticMatch) addCandidate(staticMatch);

    buildImageCandidatesFromName(productName).forEach(addCandidate);
    addCandidate("/grains/rice.jpg");

    return candidates;
  };

  const getNextImageCandidate = (productName, currentSrc) => {
    const candidates = getImageCandidateList(productName);
    const current = String(currentSrc || "").trim();

    if (!candidates.length) return "/grains/rice.jpg";
    if (!current) return candidates[0];

    const index = candidates.indexOf(current);
    if (index >= 0) return candidates[index + 1] || candidates[0];

    return candidates[0];
  };

  const uploadCatalogImage = async (file) => {
    if (!file) return "";

    const formData = new FormData();
    formData.append("image", file);

    const res = await API.post("/uploads/catalog", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return res.data.image_url;
  };

  const normalizeImagePath = (imageUrl) => {
    if (!imageUrl) return "/grains/rice.jpg";

    const normalized = String(imageUrl)
      .replace(/\\/g, "/")
      .split("?")[0]
      .split("#")[0]
      .trim();

    if (!normalized || normalized === "/") return "/grains/rice.jpg";

    if (/^https?:\/\//i.test(normalized)) {
      try {
        const parsed = new URL(normalized);
        const pathname = parsed.pathname || "";
        if (pathname.startsWith("/uploads/")) return pathname;
        if (pathname.startsWith("/grains/")) return pathname;
      } catch (_) {
        // ignore invalid URLs and fall through to the static asset handler
      }
      return normalized;
    }

    const exactLookup = normalized
      .replace(/^\//, "")
      .replace(/^grains\//i, "")
      .replace(/\.[a-z0-9]+$/i, "")
      .trim()
      .toLowerCase();

    if (STATIC_GRAIN_ASSET_PATHS[exactLookup]) {
      return STATIC_GRAIN_ASSET_PATHS[exactLookup];
    }

    if (STATIC_GRAIN_ASSET_PATHS[normalized.toLowerCase()]) {
      return STATIC_GRAIN_ASSET_PATHS[normalized.toLowerCase()];
    }

    const staticMatch = getStaticGrainAssetMatch(normalized);
    if (staticMatch) {
      return staticMatch;
    }

    const generated = buildImageCandidatesFromName(normalized);
    for (const candidate of generated) {
      if (STATIC_GRAIN_ASSET_PATHS[candidate.replace(/^\/grains\//i, "").toLowerCase()]) {
        return STATIC_GRAIN_ASSET_PATHS[candidate.replace(/^\/grains\//i, "").toLowerCase()];
      }
      if (candidate && candidate !== "/grains/rice.jpg") {
        return candidate;
      }
    }

    if (normalized.startsWith("/uploads/")) return normalized;
    if (normalized.startsWith("uploads/")) return `/${normalized}`;
    if (normalized.startsWith("/images/")) {
      return `/grains/${normalized.split("/images/").pop() || "rice.jpg"}`;
    }
    if (normalized.startsWith("images/")) {
      return `/grains/${normalized.replace(/^images\//i, "") || "rice.jpg"}`;
    }
    if (normalized.startsWith("/grains/")) {
      return normalized;
    }
    if (normalized.startsWith("/")) {
      return normalized;
    }

    return `/grains/${normalized.replace(/^grains\//i, "")}`;
  };

  /* =========================
     LOAD DATA
  ========================= */

  const fetchProducts = async () => {
    try {
      const res = await API.get("/products");
      const list = Array.isArray(res.data) ? res.data : [];

      setProducts(list);

      const allFlattenedTypes = list.flatMap((product) =>
        Array.isArray(product.types)
          ? product.types.map((type) => ({
              ...type,
              product_id: type.product_id ?? product.id,
              variant_count: Number(type.variant_count || type.variants?.length || 0),
            }))
          : []
      );

      setProductTypes(allFlattenedTypes);
      setProductVariants(
        allFlattenedTypes.flatMap((type) =>
          Array.isArray(type.variants) ? type.variants : []
        )
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to load products");
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await API.get("/categories");

      setCategories(
        Array.isArray(res.data)
          ? res.data
          : res.data?.categories || []
      );
    } catch (err) {
      console.error("CATEGORY LOAD ERROR:", err);
      toast.error("Failed to load categories");
    }
  };

  const fetchProductTypes = async (productId = null) => {
    try {
      const url = productId
        ? `/product-types/product/${productId}`
        : "/product-types";

      const res = await API.get(url);

      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.productTypes || [];

      setProductTypes(list);

      if (productId) {
        setProductVariants(list.flatMap((type) => type.variants || []));
      }

      return list;
    } catch (err) {
      console.error("PRODUCT TYPE LOAD ERROR:", err);
      toast.error("Failed to load product types");
      return [];
    }
  };

  const fetchAllProductTypes = async () => {
    try {
      const res = await API.get("/product-types");

      setAllProductTypes(
        Array.isArray(res.data) ? res.data : []
      );
    } catch (err) {
      console.error("ALL PRODUCT TYPE LOAD ERROR:", err);
    }
  };

  const fetchUnassignedVariants = async () => {
    try {
      const res = await API.get("/product-types/unassigned-variants");

      setUnassignedVariants(
        Array.isArray(res.data) ? res.data : []
      );
    } catch (err) {
      console.error("UNASSIGNED VARIANTS ERROR:", err);
    }
  };

  const refreshAll = async () => {
    await Promise.all([
      fetchProducts(),
      fetchCategories(),
      fetchAllProductTypes(),
      fetchProductTypes(),
      fetchUnassignedVariants(),
    ]);
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchAllProductTypes();
    fetchUnassignedVariants();
  }, []);

  /* =========================
     HELPERS
  ========================= */

  const getCategoryName = (categoryId) => {
    const category = categories.find(
      (item) => String(item.id) === String(categoryId)
    );

    return category?.name || "Uncategorized";
  };

  const getTypesForProduct = (productId) => {
    const productRecord = products.find(
      (product) => String(product.id) === String(productId)
    );

    if (Array.isArray(productRecord?.types)) {
      return productRecord.types.map((type) => ({
        ...type,
        product_id: type.product_id ?? productId,
        variant_count: Number(
          type.variant_count || type.variants?.length || 0
        ),
      }));
    }

    return productTypes.filter(
      (type) =>
        String(type.product_id) === String(productId)
    );
  };

  const getTypeName = (typeId) => {
    const type = productTypes.find(
      (item) => String(item.id) === String(typeId)
    );

    return type?.name || "General";
  };

  const toggleProduct = async (productId) => {
    const isOpen = expandedProductId === productId;

    setExpandedProductId(isOpen ? null : productId);
    setSelectedProductId(productId);

    setExpandedProducts((current) => ({
      ...current,
      [productId]: !current[productId],
    }));

    if (!isOpen) {
      await fetchProductTypes(productId);
    }
  };

  /* =========================
     PRODUCT
  ========================= */

  const resetProductForm = () => {
    setProductForm(emptyProduct);
    setEditingProductId(null);
    setShowProductForm(false);
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();

    if (!productForm.name.trim()) {
      toast.error("Product name is required");
      return;
    }

    if (!productForm.category_id) {
      toast.error("Please select a category");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        name: productForm.name.trim(),
        description: productForm.description || "",
        category_id: productForm.category_id
          ? Number(productForm.category_id)
          : null,
        image_url: productForm.image_url || "",
        price: 0,
        stock_quantity: 0,
        weight: "",
      };

      if (editingProductId) {
        await API.put(
          `/products/${editingProductId}`,
          payload
        );

        toast.success("Product updated");
      } else {
        await API.post("/products", payload);

        toast.success("Product created");
      }

      resetProductForm();
      await refreshAll();
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.error ||
          "Failed to save product"
      );
    } finally {
      setLoading(false);
    }
  };

  const editProduct = (product) => {
    setEditingProductId(product.id);

    setProductForm({
      name: product.name || "",
      description: product.description || "",
      category_id: product.category_id || "",
      image_url:
        product.image_url ||
        product.image ||
        "",
    });

    setShowProductForm(true);
  };

  const deleteProduct = async (id) => {
    if (
      !confirm(
        "Delete this product and its inventory variants?"
      )
    ) {
      return;
    }

    try {
      await API.delete(`/products/${id}`);

      toast.success("Product deleted");

      await refreshAll();
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.error ||
          "Failed to delete product"
      );
    }
  };

  /* =========================
     PRODUCT TYPE
  ========================= */

  const resetTypeForm = () => {
    setTypeForm(emptyType);
    setEditingTypeId(null);
    setShowTypeForm(false);
  };

  const openAddType = (product) => {
    setSelectedProductId(String(product.id));
    setEditingTypeId(null);

    setTypeForm({
      name: "",
      origin: "",
      brand: "",
      description: "",
      image: "",
    });

    setShowTypeForm(true);
  };

  const editType = (type) => {
    setEditingTypeId(type.id);

    setTypeForm({
      product_id: String(type.product_id),
      name: type.name || "",
      origin: type.origin || "",
      brand: type.brand || "",
      description: type.description || "",
      image: type.image || "",
    });

    setShowTypeForm(true);
  };

  const handleTypeSubmit = async (e) => {
    e.preventDefault();

    const targetProductId = Number(
      selectedProductId || typeForm.product_id || 0
    );

    if (!targetProductId) {
      toast.error("Product is required");
      return;
    }

    if (!typeForm.name.trim()) {
      toast.error("Product type name is required");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        product_id: targetProductId,
        name: typeForm.name.trim(),
        origin: typeForm.origin || "",
        brand: typeForm.brand || "",
        description: typeForm.description || "",
        image: typeForm.image || "",
      };

      if (editingTypeId) {
        await API.put(
          `/product-types/${editingTypeId}`,
          payload
        );

        toast.success("Product type updated");
      } else {
        await API.post(
          "/product-types",
          payload
        );

        toast.success("Product type added");
      }

      setTypeForm({
        name: "",
        origin: "",
        brand: "",
        description: "",
        image: "",
      });
      setEditingTypeId(null);
      setSelectedProductId(targetProductId);
      setShowTypeForm(false);
      await fetchProductTypes(targetProductId);
      await fetchProducts();
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.error ||
          "Failed to save product type"
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteType = async (type) => {
    if (
      !confirm(
        `Delete "${type.name}"? Existing variants will be kept.`
      )
    ) {
      return;
    }

    try {
      await API.delete(
        `/product-types/${type.id}`
      );

      toast.success("Product type deleted");

      await refreshAll();
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.error ||
          "Failed to delete product type"
      );
    }
  };

  /* =========================
     VARIANT
  ========================= */

  const openAddVariant = (product, type = null) => {
    setSelectedProduct(product);
    setSelectedProductId(product.id);
    setSelectedTypeId(type ? String(type.id) : "");

    setVariantForm({
      ...emptyVariant,
      product_type_id: type
        ? String(type.id)
        : "",
    });

    setShowVariantForm(true);
  };

  const resetVariantForm = () => {
    setVariantForm(emptyVariant);
    setSelectedProduct(null);
    setShowVariantForm(false);
  };

  const openEditVariant = (productId, variant) => {
    setEditingVariant({
      ...variant,
      product_id: productId,
    });

    setVariantUpdateForm({
      price: String(Number(variant.price || 0)),
      add_stock: "",
    });
  };

  const resetVariantUpdateForm = () => {
    setEditingVariant(null);
    setVariantUpdateForm(emptyVariantUpdate);
  };

  const handleVariantSubmit = async (e) => {
    e.preventDefault();

    const activeProductId = Number(
      selectedProductId || selectedProduct?.id || 0
    );
    const activeTypeId = Number(
      selectedTypeId || variantForm.product_type_id || 0
    );

    if (!activeProductId) {
      toast.error("Product is required");
      return;
    }

    if (!activeTypeId) {
      toast.error("Product type is required");
      return;
    }

    if (!variantForm.weight.trim()) {
      toast.error("Weight is required");
      return;
    }

    const price = Number(variantForm.price);
    const stock = Number(variantForm.stock);

    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid price");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      toast.error("Enter a valid stock quantity");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        product_type_id: activeTypeId,
        weight: variantForm.weight.trim(),
        price,
        stock,
        image: variantForm.image || "",
      };

      await API.post(
        `/products/${activeProductId}/variants`,
        payload
      );

      toast.success("Variant added");

      setVariantForm({
        weight: "",
        price: "",
        stock: "",
        image: "",
      });
      setSelectedTypeId(null);
      setShowVariantForm(false);
      await fetchProductTypes(activeProductId);
      await fetchProducts();
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.error ||
          "Failed to add variant"
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteVariant = async (
    productId,
    variantId
  ) => {
    if (!confirm("Delete this variant?")) {
      return;
    }

    try {
      await API.delete(
        `/products/${productId}/variants/${variantId}`
      );

      toast.success("Variant deleted");

      await refreshAll();
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.error ||
          "Failed to delete variant"
      );
    }
  };

  const handleVariantUpdate = async (e) => {
    e.preventDefault();

    if (!editingVariant) {
      toast.error("Variant not selected");
      return;
    }

    const newPrice = Number(variantUpdateForm.price);
    const addStock = Number(variantUpdateForm.add_stock || 0);

    if (!Number.isFinite(newPrice) || newPrice < 0) {
      toast.error("Enter a valid price");
      return;
    }

    if (!Number.isInteger(addStock) || addStock < 0) {
      toast.error("Stock increase must be a valid whole number");
      return;
    }

    const currentPrice = Number(editingVariant.price || 0);
    const currentStock = Number(editingVariant.stock || 0);
    const newStock = currentStock + addStock;

    if (newPrice === currentPrice && addStock === 0) {
      toast.error("No changes to save");
      return;
    }

    try {
      setLoading(true);

      await API.put(
        `/products/variants/${editingVariant.id}`,
        {
          product_type_id: editingVariant.product_type_id || null,
          weight: editingVariant.weight || "",
          price: newPrice,
          bulk_price: editingVariant.bulk_price ?? null,
          stock: newStock,
          image_url:
            editingVariant.image_url ||
            editingVariant.image ||
            "",
        }
      );

      toast.success("Variant updated");
      resetVariantUpdateForm();
      await refreshAll();
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.error ||
          "Failed to update variant"
      );
    } finally {
      setLoading(false);
    }
  };

  const assignVariantToType = async () => {
    if (!assigningVariant) {
      toast.error("Variant not selected");
      return;
    }

    if (!assignTypeId) {
      toast.error("Select a product type");
      return;
    }

    try {
      setLoading(true);

      await API.patch(
        `/product-types/variants/${assigningVariant.id}/assign`,
        {
          product_type_id: Number(assignTypeId),
        }
      );

      toast.success("Variant assigned successfully");
      setAssigningVariant(null);
      setAssignTypeId("");
      await fetchUnassignedVariants();
      await fetchProducts();
      if (selectedProductId) {
        await fetchProductTypes(selectedProductId);
      }
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.error ||
          "Failed to assign variant"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAssignVariant = async (variantId, productTypeId) => {
    if (!productTypeId) {
      toast.error("Select a product type");
      return;
    }

    try {
      await API.patch(
        `/product-types/variants/${variantId}/assign`,
        {
          product_type_id: Number(productTypeId),
        }
      );

      toast.success("Variant assigned successfully");
      await fetchUnassignedVariants();
      await fetchProducts();
      if (selectedProductId) {
        await fetchProductTypes(selectedProductId);
      }
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.error ||
          "Failed to assign variant"
      );
    }
  };

  /* =========================
     CATEGORY
  ========================= */

  const uploadCategoryImage = async (file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      setUploadingCategoryImage(true);

      const res = await API.post(
        "/upload/catalog",
        formData,
        {}
      );

      setCategoryForm((current) => ({
        ...current,
        image: res.data.image_url,
      }));

      toast.success("Category image uploaded");
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.error ||
          "Category image upload failed"
      );
    } finally {
      setUploadingCategoryImage(false);
    }
  };

  const resetCategoryForm = () => {
    setCategoryForm(emptyCategory);
    setShowCategoryForm(false);
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();

    if (!categoryForm.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    try {
      setLoading(true);

      const slug =
        categoryForm.slug.trim() ||
        categoryForm.name
          .toLowerCase()
          .trim()
          .replace(/\s+/g, "-");

      await API.post("/categories", {
        name: categoryForm.name.trim(),
        slug,
        description:
          categoryForm.description || "",
        image: categoryForm.image || "",
      });

      toast.success("Category created");

      resetCategoryForm();
      await refreshAll();
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.error ||
          "Failed to create category"
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     PRODUCT SUMMARY
  ========================= */

  const totalProducts = products.length;

  const totalTypes = productTypes.length;

  const totalCategories = categories.length;

  const totalVariants = useMemo(() => {
    return products.reduce(
      (total, product) => {
        const types = getTypesForProduct(
          product.id
        );

        return (
          total +
          types.reduce(
            (count, type) =>
              count +
              Number(type.variant_count || 0),
            0
          )
        );
      },
      0
    );
  }, [products, productTypes]);

  /* =========================
     UI
  ========================= */

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Agro Product Catalog
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Manage categories, products, varieties,
            weights, prices, stock and images.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">

          <button
            onClick={() =>
              setShowCategoryForm(true)
            }
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            + Category
          </button>

          <button
            onClick={() => {
              resetProductForm();
              setShowProductForm(true);
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            + Product
          </button>

        </div>
      </div>

      {/* SUMMARY */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-sm text-gray-500">
            Categories
          </div>

          <div className="text-2xl font-bold mt-1">
            {totalCategories}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-sm text-gray-500">
            Products
          </div>

          <div className="text-2xl font-bold mt-1">
            {totalProducts}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-sm text-gray-500">
            Product Types
          </div>

          <div className="text-2xl font-bold mt-1">
            {totalTypes}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-sm text-gray-500">
            Variants
          </div>

          <div className="text-2xl font-bold mt-1">
            {totalVariants}
          </div>
        </div>

      </div>

      {/* CATEGORY FORM */}

      {showCategoryForm && (
        <form
          onSubmit={handleCategorySubmit}
          className="bg-white rounded-xl shadow p-5"
        >
          <div className="flex justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Add Category
            </h2>

            <button
              type="button"
              onClick={resetCategoryForm}
              className="text-gray-500"
            >
              Close
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">

            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Category name e.g. Grains"
              value={categoryForm.name}
              onChange={(e) =>
                setCategoryForm({
                  ...categoryForm,
                  name: e.target.value,
                })
              }
            />

            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Slug e.g. grains"
              value={categoryForm.slug}
              onChange={(e) =>
                setCategoryForm({
                  ...categoryForm,
                  slug: e.target.value,
                })
              }
            />

            <textarea
              className="border rounded-lg px-3 py-2 md:col-span-2"
              placeholder="Category description"
              value={categoryForm.description}
              onChange={(e) =>
                setCategoryForm({
                  ...categoryForm,
                  description: e.target.value,
                })
              }
            />

            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Category image
              </label>

              <div className="flex flex-col gap-3">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadCategoryImage(file);
                    }
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white"
                />

                {uploadingCategoryImage && (
                  <span className="text-sm text-purple-700">
                    Uploading category image...
                  </span>
                )}
              </div>

              <input
                className="border rounded-lg px-3 py-2 w-full"
                placeholder="Category image URL"
                value={categoryForm.image}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    image: e.target.value,
                  })
                }
              />
            </div>

          </div>

          {categoryForm.image && (
            <img
              src={normalizeImagePath(categoryForm.image)}
              alt="Category preview"
              className="mt-4 h-24 w-24 object-cover rounded-lg border"
            />
          )}

          <button
            disabled={loading || uploadingCategoryImage}
            className="mt-4 bg-purple-600 text-white px-5 py-2 rounded-lg disabled:opacity-50"
          >
            {loading
              ? "Saving..."
              : "Save Category"}
          </button>
        </form>
      )}

      {/* PRODUCT FORM */}

      {showProductForm && (
        <form
          onSubmit={handleProductSubmit}
          className="bg-white rounded-xl shadow p-5"
        >
          <div className="flex justify-between mb-4">

            <div>
              <h2 className="text-lg font-semibold">
                {editingProductId
                  ? "Edit Product"
                  : "Add Product"}
              </h2>

              <p className="text-sm text-gray-500">
                Example: Rice, Beans, Maize,
                Groundnut
              </p>
            </div>

            <button
              type="button"
              onClick={resetProductForm}
              className="text-gray-500"
            >
              Close
            </button>

          </div>

          <div className="grid md:grid-cols-2 gap-4">

            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Product name"
              value={productForm.name}
              onChange={(e) =>
                setProductForm({
                  ...productForm,
                  name: e.target.value,
                })
              }
            />

            <select
              className="border rounded-lg px-3 py-2 bg-white"
              value={productForm.category_id}
              onChange={(e) =>
                setProductForm({
                  ...productForm,
                  category_id: e.target.value,
                })
              }
              required
            >
              <option value="">
                Select Category *
              </option>

              {categories
                .filter(
                  (category) =>
                    category.status !== false
                )
                .map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                ))}
            </select>

            <textarea
              className="border rounded-lg px-3 py-2 md:col-span-2"
              placeholder="Product description"
              value={productForm.description}
              onChange={(e) =>
                setProductForm({
                  ...productForm,
                  description: e.target.value,
                })
              }
            />

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Product Image
              </label>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  try {
                    setLoading(true);
                    const imageUrl = await uploadCatalogImage(file);
                    setProductForm({
                      ...productForm,
                      image_url: imageUrl,
                    });
                    toast.success("Product image uploaded");
                  } catch (err) {
                    console.error(err);
                    toast.error(
                      err.response?.data?.error ||
                        "Image upload failed"
                    );
                  } finally {
                    setLoading(false);
                  }
                }}
                className="border rounded-lg px-3 py-2 w-full bg-white"
              />

              {productForm.image_url && (
                <img
                  src={normalizeImagePath(
                    productForm.image_url
                  )}
                  alt="Product preview"
                  className="mt-3 h-24 w-24 object-cover rounded-lg border"
                />
              )}
            </div>

          </div>

          <button
            disabled={loading}
            className="mt-4 bg-green-600 text-white px-5 py-2 rounded-lg disabled:opacity-50"
          >
            {loading
              ? "Saving..."
              : editingProductId
              ? "Update Product"
              : "Save Product"}
          </button>
        </form>
      )}

      {/* PRODUCT TYPE FORM */}

      {showTypeForm && (
        <form
          onSubmit={handleTypeSubmit}
          className="bg-white rounded-xl shadow p-5"
        >
          <div className="flex justify-between mb-4">

            <h2 className="text-lg font-semibold">
              {editingTypeId
                ? "Edit Product Type"
                : "Add Product Type / Variety"}
            </h2>

            <button
              type="button"
              onClick={resetTypeForm}
              className="text-gray-500"
            >
              Close
            </button>

          </div>

          <div className="grid md:grid-cols-2 gap-4">

            <select
              className="border rounded-lg px-3 py-2 bg-white"
              value={typeForm.product_id}
              onChange={(e) =>
                setTypeForm({
                  ...typeForm,
                  product_id: e.target.value,
                })
              }
              disabled={Boolean(editingTypeId)}
            >
              <option value="">
                Select product
              </option>

              {products.map((product) => (
                <option
                  key={product.id}
                  value={product.id}
                >
                  {product.name}
                </option>
              ))}
            </select>

            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Type / Variety name"
              value={typeForm.name}
              onChange={(e) =>
                setTypeForm({
                  ...typeForm,
                  name: e.target.value,
                })
              }
            />

            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Origin e.g. Kaduna"
              value={typeForm.origin}
              onChange={(e) =>
                setTypeForm({
                  ...typeForm,
                  origin: e.target.value,
                })
              }
            />

            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Brand"
              value={typeForm.brand}
              onChange={(e) =>
                setTypeForm({
                  ...typeForm,
                  brand: e.target.value,
                })
              }
            />

            <textarea
              className="border rounded-lg px-3 py-2 md:col-span-2"
              placeholder="Description"
              value={typeForm.description}
              onChange={(e) =>
                setTypeForm({
                  ...typeForm,
                  description: e.target.value,
                })
              }
            />

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Variety Image
              </label>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  try {
                    setLoading(true);
                    const imageUrl = await uploadCatalogImage(file);
                    setTypeForm({
                      ...typeForm,
                      image: imageUrl,
                    });
                    toast.success("Product type image uploaded");
                  } catch (err) {
                    console.error(err);
                    toast.error(
                      err.response?.data?.error ||
                        "Image upload failed"
                    );
                  } finally {
                    setLoading(false);
                  }
                }}
                className="border rounded-lg px-3 py-2 w-full bg-white"
              />

              {typeForm.image && (
                <img
                  src={normalizeImagePath(typeForm.image)}
                  alt="Type preview"
                  className="mt-3 h-24 w-24 object-cover rounded-lg border"
                />
              )}
            </div>

          </div>

          <button
            disabled={loading}
            className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-lg disabled:opacity-50"
          >
            {loading
              ? "Saving..."
              : editingTypeId
              ? "Update Type"
              : "Save Product Type"}
          </button>
        </form>
      )}

      {/* VARIANT FORM */}

      {showVariantForm && (
        <form
          onSubmit={handleVariantSubmit}
          className="bg-white rounded-xl shadow p-5"
        >
          <div className="flex justify-between mb-4">

            <div>
              <h2 className="text-lg font-semibold">
                Add Variant
              </h2>

              <p className="text-sm text-gray-500">
                Product:{" "}
                <strong>
                  {selectedProduct?.name}
                </strong>
              </p>
            </div>

            <button
              type="button"
              onClick={resetVariantForm}
              className="text-gray-500"
            >
              Close
            </button>

          </div>

          <div className="grid md:grid-cols-4 gap-4">

            <select
              className="border rounded-lg px-3 py-2 bg-white"
              value={variantForm.product_type_id}
              onChange={(e) =>
                setVariantForm({
                  ...variantForm,
                  product_type_id:
                    e.target.value,
                })
              }
            >
              <option value="">
                General Variant
              </option>

              {getTypesForProduct(
                selectedProduct?.id
              ).map((type) => (
                <option
                  key={type.id}
                  value={type.id}
                >
                  {type.name}
                </option>
              ))}
            </select>

            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Weight e.g. 25kg"
              value={variantForm.weight}
              onChange={(e) =>
                setVariantForm({
                  ...variantForm,
                  weight: e.target.value,
                })
              }
            />

            <input
              type="number"
              className="border rounded-lg px-3 py-2"
              placeholder="Price"
              value={variantForm.price}
              onChange={(e) =>
                setVariantForm({
                  ...variantForm,
                  price: e.target.value,
                })
              }
            />

            <input
              type="number"
              className="border rounded-lg px-3 py-2"
              placeholder="Stock"
              value={variantForm.stock}
              onChange={(e) =>
                setVariantForm({
                  ...variantForm,
                  stock: e.target.value,
                })
              }
            />

            <div>
              <label className="block text-sm font-medium mb-1">
                Variant Image
              </label>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  try {
                    const imageUrl = await uploadCatalogImage(file);
                    setVariantForm({
                      ...variantForm,
                      image: imageUrl,
                    });
                    toast.success("Variant image uploaded");
                  } catch (err) {
                    console.error(err);
                    toast.error(
                      err.response?.data?.error ||
                        "Image upload failed"
                    );
                  }
                }}
                className="border rounded-lg px-3 py-2 w-full bg-white"
              />

              {variantForm.image && (
                <img
                  src={normalizeImagePath(variantForm.image)}
                  alt="Variant preview"
                  className="mt-2 h-20 w-20 object-cover rounded-lg border"
                />
              )}
            </div>

          </div>

          <button
            disabled={loading}
            className="mt-4 bg-orange-600 text-white px-5 py-2 rounded-lg disabled:opacity-50"
          >
            {loading
              ? "Saving..."
              : "Save Variant"}
          </button>
        </form>
      )}

      {editingVariant && (
        <form
          onSubmit={handleVariantUpdate}
          className="bg-white rounded-xl shadow p-5 border border-green-200"
        >
          <div className="flex justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Update Variant Price & Stock
              </h2>
              <p className="text-sm text-gray-500">
                {editingVariant.weight} • Current stock: {Number(editingVariant.stock || 0)}
              </p>
            </div>

            <button
              type="button"
              onClick={resetVariantUpdateForm}
              className="text-gray-500"
            >
              Close
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                New price
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={variantUpdateForm.price}
                onChange={(e) =>
                  setVariantUpdateForm((current) => ({
                    ...current,
                    price: e.target.value,
                  }))
                }
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Increase stock by
              </label>

              <input
                type="number"
                min="0"
                step="1"
                value={variantUpdateForm.add_stock}
                onChange={(e) =>
                  setVariantUpdateForm((current) => ({
                    ...current,
                    add_stock: e.target.value,
                  }))
                }
                placeholder="0"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                New total stock
              </label>

              <div className="h-10 px-3 rounded-lg border bg-gray-50 flex items-center font-semibold text-gray-700">
                {Number(editingVariant.stock || 0) + Number(variantUpdateForm.add_stock || 0)}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              disabled={loading}
              className="bg-green-600 text-white px-5 py-2 rounded-lg disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={resetVariantUpdateForm}
              className="bg-gray-200 px-5 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {assigningVariant && (
        <div className="bg-white rounded-xl shadow p-5 border border-blue-200">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Assign Variant to Product Type
              </h2>
              <p className="text-sm text-gray-500">
                {assigningVariant.weight} • {assigningVariant.product_id}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAssigningVariant(null);
                setAssignTypeId("");
              }}
              className="text-gray-500"
            >
              Close
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-500">Weight</div>
              <div className="font-semibold">{assigningVariant.weight}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Price</div>
              <div className="font-semibold">
                ₦{Number(assigningVariant.price || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Stock</div>
              <div className="font-semibold">{assigningVariant.stock}</div>
            </div>
          </div>

          <select
            value={assignTypeId}
            onChange={(e) => setAssignTypeId(e.target.value)}
            className="w-full border rounded-lg px-3 py-3 bg-white"
          >
            <option value="">Select product type</option>
            {productTypes
              .filter(
                (type) =>
                  String(type.product_id) === String(assigningVariant.product_id)
              )
              .map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                  {type.origin ? ` — ${type.origin}` : ""}
                </option>
              ))}
          </select>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              disabled={loading}
              onClick={assignVariantToType}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg disabled:opacity-50"
            >
              {loading ? "Assigning..." : "Assign Variant"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAssigningVariant(null);
                setAssignTypeId("");
              }}
              className="bg-gray-200 px-5 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {unassignedVariants.length > 0 && (
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Unassigned Inventory
            </h2>
            <span className="text-sm text-gray-500">
              {unassignedVariants.length} item
              {unassignedVariants.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-left px-4 py-3">Weight</th>
                  <th className="text-left px-4 py-3">Price</th>
                  <th className="text-left px-4 py-3">Stock</th>
                  <th className="text-left px-4 py-3">Assign To</th>
                </tr>
              </thead>
              <tbody>
                {unassignedVariants.map((variant) => (
                  <tr key={variant.id} className="border-t">
                    <td className="px-4 py-3 font-semibold">
                      {variant.product_name}
                    </td>
                    <td className="px-4 py-3">{variant.weight}</td>
                    <td className="px-4 py-3">
                      ₦{Number(variant.price || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{variant.stock}</td>
                    <td className="px-4 py-3">
                      <select
                        defaultValue=""
                        onChange={(e) =>
                          handleAssignVariant(
                            variant.id,
                            e.target.value
                          )
                        }
                        className="border rounded-lg px-3 py-2 bg-white"
                      >
                        <option value="">Select Product Type</option>
                        {allProductTypes
                          .filter(
                            (type) =>
                              String(type.product_id) === String(variant.product_id)
                          )
                          .map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.name}
                            </option>
                          ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRODUCT LIST */}

      <div className="space-y-4">

        {products.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
            No products found.
          </div>
        ) : (
          products.map((product) => {

            const types =
              getTypesForProduct(product.id);

            const expanded =
              expandedProducts[product.id];

            return (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow overflow-hidden"
              >

                {/* PRODUCT HEADER */}

                <div className="p-5">

                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">

                    <img
                      src={normalizeImagePath(
                        product.image ||
                          product.image_url
                      )}
                      alt={product.name}
                      className="h-20 w-20 object-cover rounded-xl border"
                      onError={(e) => {
                        const current = e.currentTarget.getAttribute("src");
                        const next = getNextImageCandidate(product?.name, current);

                        if (next && next !== current) {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = next;
                          return;
                        }

                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/grains/rice.jpg";
                      }}
                    />

                    <div className="flex-1">

                      <div className="flex flex-wrap items-center gap-2">

                        <h2 className="text-xl font-bold">
                          {product.name}
                        </h2>

                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          {getCategoryName(
                            product.category_id
                          )}
                        </span>

                      </div>

                      <p className="text-sm text-gray-500 mt-1">
                        {product.description ||
                          "No description"}
                      </p>

                      <div className="text-sm text-gray-500 mt-2">
                        {types.length} product type
                        {types.length !== 1
                          ? "s"
                          : ""}
                      </div>

                    </div>

                    <div className="flex flex-wrap gap-2">

                      <button
                        onClick={() =>
                          openAddType(product)
                        }
                        className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm"
                      >
                        + Type
                      </button>

                      <button
                        onClick={() =>
                          openAddVariant(product)
                        }
                        className="bg-orange-600 text-white px-3 py-2 rounded-lg text-sm"
                      >
                        + Variant
                      </button>

                      <button
                        onClick={() =>
                          editProduct(product)
                        }
                        className="bg-yellow-500 text-white px-3 py-2 rounded-lg text-sm"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          deleteProduct(product.id)
                        }
                        className="bg-red-500 text-white px-3 py-2 rounded-lg text-sm"
                      >
                        Delete
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleProduct(product.id)
                        }
                        className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm"
                      >
                        {expandedProductId === product.id
                          ? "Close Catalog"
                          : "Manage Catalog"}
                      </button>

                    </div>

                  </div>

                </div>

                {/* TYPES */}

                {expanded && (
                  <div className="border-t bg-gray-50 p-5">

                    {types.length === 0 ? (
                      <div className="text-center py-6 text-gray-500">

                        <p>
                          No product types yet.
                        </p>

                        <button
                          onClick={() =>
                            openAddType(product)
                          }
                          className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg"
                        >
                          + Add First Type
                        </button>

                      </div>
                    ) : (
                      <div className="space-y-4">

                        {types.map((type) => (

                          <div
                            key={type.id}
                            className="bg-white border rounded-xl p-4"
                          >

                            <div className="flex flex-col lg:flex-row lg:items-center gap-4">

                              {type.image && (
                                <img
                                  src={normalizeImagePath(
                                    type.image
                                  )}
                                  alt={type.name}
                                  className="h-16 w-16 object-cover rounded-lg"
                                />
                              )}

                              <div className="flex-1">

                                <h3 className="font-bold text-lg">
                                  {type.name}
                                </h3>

                                <div className="flex flex-wrap gap-2 mt-1">

                                  {type.origin && (
                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                      Origin:{" "}
                                      {type.origin}
                                    </span>
                                  )}

                                  {type.brand && (
                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                      Brand:{" "}
                                      {type.brand}
                                    </span>
                                  )}

                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                    {type.variant_count ||
                                      0}{" "}
                                    variants
                                  </span>

                                </div>

                              </div>

                              <div className="flex gap-2">

                                <button
                                  onClick={() =>
                                    openAddVariant(
                                      product,
                                      type
                                    )
                                  }
                                  className="bg-orange-600 text-white px-3 py-2 rounded-lg text-sm"
                                >
                                  + Variant
                                </button>

                                <button
                                  onClick={() =>
                                    editType(type)
                                  }
                                  className="bg-yellow-500 text-white px-3 py-2 rounded-lg text-sm"
                                >
                                  Edit
                                </button>

                                <button
                                  onClick={() =>
                                    deleteType(type)
                                  }
                                  className="bg-red-500 text-white px-3 py-2 rounded-lg text-sm"
                                >
                                  Delete
                                </button>

                              </div>

                            </div>

                            {/* VARIANTS */}

                            <div className="mt-4">

                              <div className="text-sm font-semibold text-gray-700 mb-2">
                                Inventory Variants
                              </div>

                              {product.types
                                ?.find(
                                  (item) =>
                                    String(
                                      item.id
                                    ) ===
                                    String(type.id)
                                )
                                ?.variants?.length >
                              0 ? (
                                <div className="overflow-x-auto">

                                  <table className="min-w-full text-sm">

                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="text-left px-3 py-2">
                                          Weight
                                        </th>

                                        <th className="text-left px-3 py-2">
                                          Price
                                        </th>

                                        <th className="text-left px-3 py-2">
                                          Stock
                                        </th>

                                        <th className="text-left px-3 py-2">
                                          Action
                                        </th>
                                      </tr>
                                    </thead>

                                    <tbody>

                                      {product.types
                                        ?.find(
                                          (item) =>
                                            String(
                                              item.id
                                            ) ===
                                            String(
                                              type.id
                                            )
                                        )
                                        ?.variants?.map(
                                          (
                                            variant
                                          ) => (

                                            <tr
                                              key={
                                                variant.id
                                              }
                                              className="border-t"
                                            >

                                              <td className="px-3 py-2 font-medium">
                                                {
                                                  variant.weight
                                                }
                                              </td>

                                              <td className="px-3 py-2">
                                                ₦
                                                {Number(
                                                  variant.price ||
                                                    0
                                                ).toLocaleString()}
                                              </td>

                                              <td className="px-3 py-2">

                                                <span
                                                  className={
                                                    Number(
                                                      variant.stock
                                                    ) <=
                                                    0
                                                      ? "text-red-600 font-semibold"
                                                      : "text-green-600 font-semibold"
                                                  }
                                                >
                                                  {
                                                    variant.stock
                                                  }
                                                </span>

                                              </td>

                                              <td className="px-3 py-2 space-y-2">

                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    openEditVariant(
                                                      product.id,
                                                      variant
                                                    )
                                                  }
                                                  className="bg-green-600 text-white px-2 py-1 rounded text-xs"
                                                >
                                                  Edit Price/Stock
                                                </button>

                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setAssigningVariant(variant);
                                                    setAssignTypeId(
                                                      variant.product_type_id || ""
                                                    );
                                                  }}
                                                  className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
                                                >
                                                  Assign Type
                                                </button>

                                                <div>
                                                  <button
                                                    onClick={() =>
                                                      deleteVariant(
                                                        product.id,
                                                        variant.id
                                                      )
                                                    }
                                                    className="text-red-600 hover:underline text-xs"
                                                  >
                                                    Delete
                                                  </button>
                                                </div>

                                              </td>

                                            </tr>

                                          )
                                        )}

                                    </tbody>

                                  </table>

                                </div>
                              ) : (
                                <div className="text-sm text-gray-400 py-3">
                                  No variants assigned
                                  to this product
                                  type yet.
                                </div>
                              )}

                            </div>

                          </div>

                        ))}

                      </div>
                    )}

                  </div>
                )}

              </div>
            );
          })
        )}

      </div>

    </div>
  );
}