import {
  Designer,
  BrandBranch,
  Season,
  Lookbook,
  Look,
  Item,
  Listing,
  Note,
  User,
  DesignerReview,
  DesignerBrandHistory,
} from "../types";

// Mock Designers
export const mockDesigners: Designer[] = [
  {
    id: "designer-1",
    name: "Yohji Yamamoto",
    aliases: ["Y.Y.", "山本耀司"],
    letterIndex: "Y",
    bio: "Master of avant-garde fashion, known for oversized silhouettes and poetic black garments. His work explores the relationship between Eastern and Western aesthetics, creating garments that are both architectural and deeply personal.",
    foundedYear: 1972,
    country: "Japan",
    imageUrl: "/placeholders/designer-yohji.jpg",
    coverImageUrl: "/placeholders/designer-yohji-cover.jpg",
    rating: 4.8,
    reviewCount: 156,
    followerCount: 12500,
    isFollowed: false,
  },
  {
    id: "designer-2",
    name: "Rei Kawakubo",
    aliases: ["川久保玲"],
    letterIndex: "R",
    bio: "Founder of Comme des Garçons, revolutionary designer challenging conventional beauty. Her conceptual approach to fashion has redefined the boundaries of clothing and art.",
    foundedYear: 1969,
    country: "Japan",
    imageUrl: "/placeholders/designer-rei.jpg",
    coverImageUrl: "/placeholders/designer-rei-cover.jpg",
    rating: 4.9,
    reviewCount: 203,
    followerCount: 18700,
    isFollowed: true,
  },
  {
    id: "designer-3",
    name: "Maison Margiela",
    aliases: ["Martin Margiela", "MMM"],
    letterIndex: "M",
    bio: "Deconstructionist fashion house known for conceptual and artisanal collections. The brand continues to challenge fashion norms through anonymity and experimental design.",
    foundedYear: 1988,
    country: "France",
    imageUrl: "/placeholders/designer-margiela.jpg",
    coverImageUrl: "/placeholders/designer-margiela-cover.jpg",
    rating: 4.7,
    reviewCount: 89,
    followerCount: 9800,
    isFollowed: false,
  },
];

// Mock Brand Branches
export const mockBrandBranches: BrandBranch[] = [
  {
    id: "branch-1",
    designerId: "designer-1",
    name: "Y's",
    era: "1977-present",
    description:
      "The diffusion line focusing on everyday wear with architectural details.",
    logoUrl: "/placeholders/logo-ys.jpg",
  },
  {
    id: "branch-2",
    designerId: "designer-1",
    name: "Ground Y",
    era: "2014-present",
    description:
      "Street-inspired line merging youth culture with Yamamoto aesthetics.",
    logoUrl: "/placeholders/logo-ground-y.jpg",
  },
  {
    id: "branch-3",
    designerId: "designer-2",
    name: "Comme des Garçons",
    era: "1969-present",
    description:
      "Main line presenting radical concepts and unconventional beauty.",
    logoUrl: "/placeholders/logo-cdg.jpg",
  },
  {
    id: "branch-4",
    designerId: "designer-2",
    name: "Comme des Garçons PLAY",
    era: "2002-present",
    description: "Accessible line featuring the iconic heart logo.",
    logoUrl: "/placeholders/logo-cdg-play.jpg",
  },
  {
    id: "branch-5",
    designerId: "designer-3",
    name: "MM6 Maison Margiela",
    era: "1997-present",
    description:
      "Contemporary line with a more accessible approach to the house codes.",
    logoUrl: "/placeholders/logo-mm6.jpg",
  },
];

// Mock Seasons
export const mockSeasons: Season[] = [
  {
    id: "season-1",
    year: 2024,
    code: "FW",
    label: "Fall/Winter 2024",
  },
  {
    id: "season-2",
    year: 2024,
    code: "SS",
    label: "Spring/Summer 2024",
  },
  {
    id: "season-3",
    year: 2025,
    code: "SS",
    label: "Spring/Summer 2025",
  },
];

// Mock Lookbooks
export const mockLookbooks: Lookbook[] = [
  {
    id: "lookbook-1",
    brandBranchId: "branch-1",
    seasonId: "season-1",
    title: "Y's Fall/Winter 2024",
    coverUrl: "/placeholders/lookbook-ys-fw24.jpg",
    location: "Paris",
    date: "2024-03-02",
    description:
      "Exploring the intersection of utility and poetry through layered silhouettes.",
  },
  {
    id: "lookbook-2",
    brandBranchId: "branch-3",
    seasonId: "season-1",
    title: "Comme des Garçons Fall/Winter 2024",
    coverUrl: "/placeholders/lookbook-cdg-fw24.jpg",
    location: "Paris",
    date: "2024-03-01",
    description:
      "Deconstructed tailoring meets organic forms in monochromatic palette.",
  },
  {
    id: "lookbook-3",
    brandBranchId: "branch-5",
    seasonId: "season-2",
    title: "MM6 Spring/Summer 2024",
    coverUrl: "/placeholders/lookbook-mm6-ss24.jpg",
    location: "Milan",
    date: "2023-09-22",
    description: "Reimagining wardrobe staples through the Margiela lens.",
  },
];

// Mock Looks
export const mockLooks: Look[] = [
  // Y's FW24 Looks
  {
    id: "look-1",
    lookbookId: "lookbook-1",
    index: 1,
    title: "Opening Look",
    description: "Asymmetric wool coat over layered cotton separates",
    images: ["/placeholders/look-1-1.jpg", "/placeholders/look-1-2.jpg"],
    silhouette: "Oversized, cocoon-like",
    materials: ["Virgin wool", "Organic cotton", "Linen blend"],
    details: "Raw edge finishing, hidden button placket, adjustable hem",
    inspiration: "Japanese workwear meets European tailoring",
  },
  {
    id: "look-2",
    lookbookId: "lookbook-1",
    index: 2,
    description: "Deconstructed blazer with wide-leg trousers",
    images: ["/placeholders/look-2-1.jpg"],
    silhouette: "Architectural, boxy upper with fluid lower",
    materials: ["Wool gabardine", "Cotton twill"],
    details: "Removable sleeves, convertible collar",
  },
  // CDG FW24 Looks
  {
    id: "look-3",
    lookbookId: "lookbook-2",
    index: 1,
    title: "Sculptural Opening",
    description: "Padded jacket with circular cutouts over mesh base",
    images: ["/placeholders/look-3-1.jpg", "/placeholders/look-3-2.jpg"],
    silhouette: "Spherical, gravity-defying",
    materials: ["Technical nylon", "Power mesh", "Down filling"],
    details: "Magnetic closures, detachable padding modules",
    inspiration: "Body as architecture, clothing as shelter",
  },
  {
    id: "look-4",
    lookbookId: "lookbook-2",
    index: 2,
    description: "Hybrid dress-coat with integrated scarf detail",
    images: ["/placeholders/look-4-1.jpg"],
    silhouette: "Columnar with trailing elements",
    materials: ["Boiled wool", "Silk organza"],
    details: "Hidden pockets, adjustable draping points",
  },
  // MM6 SS24 Looks
  {
    id: "look-5",
    lookbookId: "lookbook-3",
    index: 1,
    title: "Deconstructed Trench",
    description: "Inside-out trench coat with exposed lining",
    images: ["/placeholders/look-5-1.jpg"],
    silhouette: "Classic A-line with subversive details",
    materials: ["Cotton gabardine", "Cupro lining"],
    details: "Four white stitches, reversed buttons",
    inspiration: "Wardrobe staples turned inside out",
  },
];

// Mock Items
export const mockItems: Item[] = [
  {
    id: "item-1",
    lookId: "look-1",
    category: "outerwear",
    name: "Asymmetric Wool Coat",
    material: "100% Virgin Wool",
    sizeInfo: "JP 1-3 (Unisex)",
    msrp: 2800,
    sku: "YS-FW24-001",
    description: "Signature oversized coat with raw edges and adjustable hem",
    images: ["/placeholders/item-1-1.jpg", "/placeholders/item-1-2.jpg"],
  },
  {
    id: "item-2",
    lookId: "look-1",
    category: "tops",
    name: "Layered Cotton Shirt",
    material: "Organic Cotton",
    sizeInfo: "JP 1-3",
    msrp: 680,
    sku: "YS-FW24-002",
    description: "Double-layered shirt with asymmetric hemline",
    images: ["/placeholders/item-2-1.jpg"],
  },
  {
    id: "item-3",
    lookId: "look-3",
    category: "outerwear",
    name: "Sculptural Padded Jacket",
    material: "Technical Nylon with Down Fill",
    sizeInfo: "XS-M",
    msrp: 4500,
    sku: "CDG-FW24-001",
    description: "Experimental padded jacket with circular cutouts",
    images: ["/placeholders/item-3-1.jpg"],
  },
  {
    id: "item-4",
    lookId: "look-5",
    category: "outerwear",
    name: "Inside-Out Trench",
    material: "Cotton Gabardine",
    sizeInfo: "IT 38-44",
    msrp: 1200,
    sku: "MM6-SS24-001",
    description: "Classic trench reimagined with exposed construction",
    images: ["/placeholders/item-4-1.jpg"],
  },
];

// Mock Listings
export const mockListings: Listing[] = [
  {
    id: "listing-1",
    itemId: "item-1",
    type: "for_sale",
    price: 2100,
    currency: "USD",
    link: "https://example.com/listing-1",
    sellerId: "user-2",
    status: "active",
    condition: "New with tags",
    size: "JP 2",
    location: "Tokyo, Japan",
    createdAt: "2024-09-15T10:00:00Z",
    updatedAt: "2024-09-15T10:00:00Z",
  },
  {
    id: "listing-2",
    itemId: "item-1",
    type: "wanted",
    price: 1800,
    currency: "USD",
    sellerId: "user-3",
    status: "active",
    size: "JP 1",
    location: "New York, USA",
    createdAt: "2024-09-14T15:30:00Z",
    updatedAt: "2024-09-14T15:30:00Z",
  },
  {
    id: "listing-3",
    itemId: "item-3",
    type: "for_sale",
    price: 3800,
    currency: "EUR",
    link: "https://example.com/listing-3",
    sellerId: "user-4",
    status: "active",
    condition: "Excellent, worn once",
    size: "S",
    location: "Paris, France",
    createdAt: "2024-09-10T09:00:00Z",
    updatedAt: "2024-09-10T09:00:00Z",
  },
];

// Mock Users
export const mockUsers: User[] = [
  {
    id: "user-1",
    nickname: "fashion_archive",
    email: "archive@example.com",
    avatarUrl: "/placeholders/avatar-1.jpg",
    bio: "Documenting avant-garde fashion since 2020",
    joinedAt: "2020-01-15T00:00:00Z",
  },
  {
    id: "user-2",
    nickname: "tokyo_vintage",
    email: "tokyo@example.com",
    avatarUrl: "/placeholders/avatar-2.jpg",
    bio: "Japanese designer archive specialist",
    joinedAt: "2021-03-20T00:00:00Z",
  },
  {
    id: "user-3",
    nickname: "runway_collector",
    email: "collector@example.com",
    avatarUrl: "/placeholders/avatar-3.jpg",
    bio: "Collecting runway pieces from FW20 onwards",
    joinedAt: "2022-06-10T00:00:00Z",
  },
  {
    id: "user-4",
    nickname: "cdg_enthusiast",
    email: "cdg@example.com",
    avatarUrl: "/placeholders/avatar-4.jpg",
    bio: "Comme des Garçons universe explorer",
    joinedAt: "2023-01-05T00:00:00Z",
  },
];

// Mock Notes
export const mockNotes: Note[] = [
  {
    id: "note-1",
    targetType: "look",
    targetId: "look-1",
    authorId: "user-1",
    content:
      "The layering technique here reminds me of early 90s Yamamoto work. Notice how the coat creates a protective shell while maintaining fluidity. 这种层次感让我想起90年代早期的山本作品。",
    images: [],
    tags: ["#YohjiYamamoto", "#Layering", "#FW24"],
    createdAt: "2024-09-18T14:00:00Z",
    updatedAt: "2024-09-18T14:00:00Z",
  },
  {
    id: "note-2",
    targetType: "item",
    targetId: "item-3",
    authorId: "user-4",
    content:
      "Saw this piece in person at Dover Street Market. The construction is even more impressive than photos suggest. Each padding module can be rearranged!",
    images: ["/placeholders/note-2-1.jpg"],
    tags: ["#CDG", "#DSM", "#Sculptural"],
    createdAt: "2024-09-17T11:30:00Z",
    updatedAt: "2024-09-17T11:30:00Z",
  },
  {
    id: "note-3",
    targetType: "lookbook",
    targetId: "lookbook-3",
    authorId: "user-2",
    content:
      "MM6 continues to democratize the Margiela codes. This collection feels more wearable while maintaining the house DNA.",
    images: [],
    tags: ["#MM6", "#MaisonMargiela", "#SS24"],
    createdAt: "2024-09-16T09:15:00Z",
    updatedAt: "2024-09-16T09:15:00Z",
  },
];

// Mock Designer Reviews
export const mockDesignerReviews: DesignerReview[] = [
  {
    id: "review-1",
    designerId: "designer-1",
    userId: "user-1",
    rating: 5,
    comment:
      "Yamamoto's work is pure poetry in fabric. His understanding of silhouette and proportion is unmatched. Every piece tells a story of Japanese aesthetics meeting Western tailoring.",
    createdAt: "2024-09-10T14:30:00Z",
    updatedAt: "2024-09-10T14:30:00Z",
    helpful: 24,
  },
  {
    id: "review-2",
    designerId: "designer-1",
    userId: "user-3",
    rating: 5,
    comment:
      "The master of black. Yamamoto's pieces are investment pieces that transcend trends. His FW24 collection was absolutely stunning.",
    createdAt: "2024-09-08T10:15:00Z",
    updatedAt: "2024-09-08T10:15:00Z",
    helpful: 18,
  },
  {
    id: "review-3",
    designerId: "designer-2",
    userId: "user-4",
    rating: 5,
    comment:
      "Rei Kawakubo continues to challenge everything we think we know about fashion. CDG is not just clothing, it's conceptual art.",
    createdAt: "2024-09-12T16:45:00Z",
    updatedAt: "2024-09-12T16:45:00Z",
    helpful: 31,
  },
  {
    id: "review-4",
    designerId: "designer-2",
    userId: "user-1",
    rating: 4,
    comment:
      "Innovative and thought-provoking. Some pieces are more wearable than others, but the artistic vision is always clear.",
    createdAt: "2024-09-05T09:20:00Z",
    updatedAt: "2024-09-05T09:20:00Z",
    helpful: 12,
  },
  {
    id: "review-5",
    designerId: "designer-3",
    userId: "user-2",
    rating: 5,
    comment:
      "The Margiela codes are timeless. MM6 makes the house aesthetic more accessible while maintaining the deconstructed DNA.",
    createdAt: "2024-09-07T13:10:00Z",
    updatedAt: "2024-09-07T13:10:00Z",
    helpful: 15,
  },
];

// Mock Designer Brand History
export const mockDesignerBrandHistory: DesignerBrandHistory[] = [
  // Yohji Yamamoto's brand history
  {
    id: "history-1",
    designerId: "designer-1",
    brandName: "Yohji Yamamoto",
    role: "Founder & Creative Director",
    startYear: 1972,
    description: "Founded his own label, pioneering avant-garde fashion",
    logoUrl: "/placeholders/logo-yohji.jpg",
    isActive: true,
  },
  {
    id: "history-2",
    designerId: "designer-1",
    brandName: "Y's",
    role: "Creative Director",
    startYear: 1977,
    description: "Diffusion line focusing on ready-to-wear",
    logoUrl: "/placeholders/logo-ys.jpg",
    isActive: true,
  },
  {
    id: "history-3",
    designerId: "designer-1",
    brandName: "Ground Y",
    role: "Creative Director",
    startYear: 2014,
    description:
      "Street-inspired line merging youth culture with Yamamoto aesthetics",
    logoUrl: "/placeholders/logo-ground-y.jpg",
    isActive: true,
  },

  // Rei Kawakubo's brand history
  {
    id: "history-4",
    designerId: "designer-2",
    brandName: "Comme des Garçons",
    role: "Founder & Creative Director",
    startYear: 1969,
    description: "Revolutionary fashion house challenging conventional beauty",
    logoUrl: "/placeholders/logo-cdg.jpg",
    isActive: true,
  },
  {
    id: "history-5",
    designerId: "designer-2",
    brandName: "Comme des Garçons PLAY",
    role: "Creative Director",
    startYear: 2002,
    description: "Accessible line featuring the iconic heart logo",
    logoUrl: "/placeholders/logo-cdg-play.jpg",
    isActive: true,
  },

  // Maison Margiela's brand history (including Hedi Slimane example)
  {
    id: "history-6",
    designerId: "designer-3",
    brandName: "Maison Margiela",
    role: "Founder",
    startYear: 1988,
    endYear: 2009,
    description: "Founded the deconstructionist fashion house",
    logoUrl: "/placeholders/logo-margiela.jpg",
    isActive: false,
  },
  {
    id: "history-7",
    designerId: "designer-3",
    brandName: "MM6 Maison Margiela",
    role: "Creative Director",
    startYear: 1997,
    description: "Contemporary line with accessible approach to house codes",
    logoUrl: "/placeholders/logo-mm6.jpg",
    isActive: true,
  },

  // Add example for Hedi Slimane style (using designer-3 as example)
  {
    id: "history-8",
    designerId: "designer-3",
    brandName: "Dior Homme",
    role: "Creative Director",
    startYear: 2000,
    endYear: 2007,
    description: "Revolutionized men's fashion with skinny silhouettes",
    logoUrl: "/placeholders/logo-dior-homme.jpg",
    isActive: false,
  },
  {
    id: "history-9",
    designerId: "designer-3",
    brandName: "Saint Laurent",
    role: "Creative Director",
    startYear: 2012,
    endYear: 2016,
    description: "Brought rock'n'roll aesthetic to the French house",
    logoUrl: "/placeholders/logo-saint-laurent.jpg",
    isActive: false,
  },
  {
    id: "history-10",
    designerId: "designer-3",
    brandName: "Celine",
    role: "Creative Director",
    startYear: 2018,
    description: "Currently leading the Parisian house with minimalist luxury",
    logoUrl: "/placeholders/logo-celine.jpg",
    isActive: true,
  },
];

// Export all mock data
export const mockData = {
  designers: mockDesigners,
  brandBranches: mockBrandBranches,
  seasons: mockSeasons,
  lookbooks: mockLookbooks,
  looks: mockLooks,
  items: mockItems,
  listings: mockListings,
  users: mockUsers,
  notes: mockNotes,
  designerReviews: mockDesignerReviews,
  designerBrandHistory: mockDesignerBrandHistory,
};
