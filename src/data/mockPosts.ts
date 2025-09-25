import { Post } from "../components/PostCard";

// Create posts array with explicit validation
const createMockPosts = (): Post[] => {
  try {
    return [
      {
        id: "post-1",
        type: "lookbook",
        author: {
          id: "designer-1",
          name: "Virginie Viard",
          avatar: "https://via.placeholder.com/60x60",
          isVerified: true,
        },
        content: {
          title: "CHANEL 2024 春夏系列",
          description:
            "在经典与创新之间寻找平衡，呈现现代女性的优雅风范。此次系列融合了香奈儿经典的斜纹软呢与现代剪裁，为当代女性打造既舒适又优雅的着装选择。",
          images: [
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
          ],
          tags: ["chanel", "春夏", "经典", "优雅"],
        },
        engagement: {
          likes: 1247,
          saves: 328,
          comments: 89,
          isLiked: false,
          isSaved: false,
        },
        timestamp: "2小时前",
        brandName: "CHANEL",
        season: "Spring/Summer 2024",
      },
      {
        id: "post-2",
        type: "outfit",
        author: {
          id: "user-1",
          name: "Emma Chen",
          avatar: "https://via.placeholder.com/60x60",
          isVerified: false,
        },
        content: {
          title: "巴黎街头优雅风",
          description:
            "经典风衣与现代配饰的完美结合，适合春日漫步的优雅造型。这套搭配将经典的英式风衣与现代感的配饰相结合，既保持了优雅的气质，又不失时尚感。",
          images: [
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
          ],
          tags: ["街头", "优雅", "春日", "经典"],
        },
        engagement: {
          likes: 456,
          saves: 123,
          comments: 34,
          isLiked: true,
          isSaved: false,
        },
        timestamp: "5小时前",
        items: [
          {
            id: "item-1",
            name: "经典风衣",
            brand: "BURBERRY",
            price: "¥18,900",
            imageUrl: "https://via.placeholder.com/150x200",
          },
          {
            id: "item-2",
            name: "链条包",
            brand: "CHANEL",
            price: "¥32,500",
            imageUrl: "https://via.placeholder.com/150x200",
          },
          {
            id: "item-3",
            name: "踝靴",
            brand: "SAINT LAURENT",
            price: "¥9,800",
            imageUrl: "https://via.placeholder.com/150x200",
          },
        ],
      },
      {
        id: "post-3",
        type: "review",
        author: {
          id: "user-2",
          name: "Sophie Liu",
          avatar: "https://via.placeholder.com/60x60",
          isVerified: true,
        },
        content: {
          title: "DIOR Saddle Bag 深度评测",
          description:
            "经典回归的马鞍包，从设计到实用性的全方位评价。这款包包在保持经典设计的同时，在实用性和现代感方面都有不错的表现。皮质手感极佳，做工精细。",
          images: [
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
          ],
          tags: ["dior", "马鞍包", "评测", "经典"],
        },
        engagement: {
          likes: 789,
          saves: 234,
          comments: 67,
          isLiked: false,
          isSaved: true,
        },
        timestamp: "1天前",
        rating: 4,
      },
      {
        id: "post-4",
        type: "article",
        author: {
          id: "editor-1",
          name: "Alice Wang",
          avatar: "https://via.placeholder.com/60x60",
          isVerified: true,
        },
        content: {
          title: "2024春夏时装周趋势解析",
          description:
            "从巴黎到米兰，解读本季最重要的时尚趋势。今年春夏的关键词是'回归自然'，设计师们用更加环保的材料和工艺，展现对可持续时尚的思考。",
          images: ["https://via.placeholder.com/400x300"],
          tags: ["时装周", "趋势", "2024", "可持续"],
        },
        engagement: {
          likes: 2134,
          saves: 567,
          comments: 189,
          isLiked: true,
          isSaved: true,
        },
        timestamp: "2天前",
        readTime: "5分钟阅读",
      },
      {
        id: "post-5",
        type: "lookbook",
        author: {
          id: "designer-2",
          name: "Anthony Vaccarello",
          avatar: "https://via.placeholder.com/60x60",
          isVerified: true,
        },
        content: {
          title: "SAINT LAURENT 2024秋冬系列",
          description:
            "摇滚精神与巴黎优雅的完美融合，展现叛逆中的精致美学。这一季我们继续探索YSL标志性的轮廓，将70年代的摇滚精神注入现代设计。",
          images: [
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
          ],
          tags: ["saint laurent", "秋冬", "摇滚", "精致"],
        },
        engagement: {
          likes: 3456,
          saves: 987,
          comments: 234,
          isLiked: false,
          isSaved: false,
        },
        timestamp: "3天前",
        brandName: "SAINT LAURENT",
        season: "Fall/Winter 2024",
      },
      {
        id: "post-6",
        type: "outfit",
        author: {
          id: "user-3",
          name: "Lily Zhang",
          avatar: "https://via.placeholder.com/60x60",
          isVerified: false,
        },
        content: {
          title: "现代极简主义通勤装",
          description:
            "简约线条与高级面料的时尚表达，适合现代都市女性的通勤造型。整体以黑白灰为主色调，通过不同材质的对比营造层次感。",
          images: ["https://via.placeholder.com/400x300"],
          tags: ["极简", "通勤", "现代", "都市"],
        },
        engagement: {
          likes: 678,
          saves: 189,
          comments: 45,
          isLiked: true,
          isSaved: true,
        },
        timestamp: "1周前",
        items: [
          {
            id: "item-4",
            name: "羊毛大衣",
            brand: "THE ROW",
            price: "¥28,600",
            imageUrl: "https://via.placeholder.com/150x200",
          },
          {
            id: "item-5",
            name: "皮革靴",
            brand: "BOTTEGA VENETA",
            price: "¥12,800",
            imageUrl: "https://via.placeholder.com/150x200",
          },
        ],
      },
      {
        id: "post-7",
        type: "review",
        author: {
          id: "user-4",
          name: "Grace Kim",
          avatar: "https://via.placeholder.com/60x60",
          isVerified: false,
        },
        content: {
          title: "Bottega Veneta Cassette包包使用体验",
          description:
            "经过3个月的日常使用，分享这款网红包包的真实感受。包包的编织工艺确实精美，但在实用性方面还是有一些需要注意的地方。",
          images: [
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
          ],
          tags: ["bottega veneta", "cassette", "使用体验", "评测"],
        },
        engagement: {
          likes: 345,
          saves: 89,
          comments: 23,
          isLiked: false,
          isSaved: false,
        },
        timestamp: "1周前",
        rating: 3,
      },
      {
        id: "post-8",
        type: "article",
        author: {
          id: "editor-2",
          name: "Victoria Chen",
          avatar: "https://via.placeholder.com/60x60",
          isVerified: true,
        },
        content: {
          title: "可持续时尚：未来的时尚选择",
          description:
            "探讨时尚产业的可持续发展之路，从材料选择到生产工艺的全方位思考。越来越多的品牌开始关注环保和可持续性，这或许是时尚产业的未来方向。",
          images: [
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
          ],
          tags: ["可持续", "环保", "时尚", "未来"],
        },
        engagement: {
          likes: 1567,
          saves: 423,
          comments: 156,
          isLiked: false,
          isSaved: true,
        },
        timestamp: "2周前",
        readTime: "8分钟阅读",
      },
    ];
  } catch (error) {
    console.error("Error creating mock posts:", error);
    return [];
  }
};

export const mockPosts: Post[] = createMockPosts();
