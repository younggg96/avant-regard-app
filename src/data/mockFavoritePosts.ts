import { Post } from "../components/PostCard";

// 基于用户收藏的单品相关帖子
const createMockFavoritePosts = (): Post[] => {
  try {
    return [
      {
        id: "fav-post-1",
        type: "outfit",
        author: {
          id: "user-5",
          name: "时尚博主 Anna",
          avatar: "https://via.placeholder.com/60x60",
          isVerified: true,
        },
        content: {
          title: "CHANEL链条包的5种搭配方式",
          description:
            "最近收藏了CHANEL的经典链条包，分享几种不同场合的搭配方法。从日常通勤到晚宴派对，一包多用，展现不同风格的魅力。",
          images: [
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
          ],
          tags: ["chanel", "链条包", "搭配", "收藏单品"],
        },
        engagement: {
          likes: 892,
          saves: 234,
          comments: 67,
          isLiked: false,
          isSaved: true,
        },
        timestamp: "1小时前",
        items: [
          {
            id: "fav-item-1",
            name: "经典链条包",
            brand: "CHANEL",
            price: "¥32,500",
            imageUrl: "https://via.placeholder.com/150x200",
          },
          {
            id: "fav-item-2",
            name: "羊毛西装",
            brand: "CHANEL",
            price: "¥28,900",
            imageUrl: "https://via.placeholder.com/150x200",
          },
          {
            id: "fav-item-3",
            name: "珍珠耳环",
            brand: "CHANEL",
            price: "¥8,600",
            imageUrl: "https://via.placeholder.com/150x200",
          },
        ],
      },
      {
        id: "fav-post-2",
        type: "review",
        author: {
          id: "user-6",
          name: "Fashion Critic",
          avatar: "https://via.placeholder.com/60x60",
          isVerified: true,
        },
        content: {
          title: "Hermès Kelly包深度测评",
          description:
            "使用了半年的Kelly包，从材质做工到日常实用性的全方位评测。对于考虑入手这款经典包包的朋友，希望能提供一些参考。",
          images: [
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
          ],
          tags: ["hermès", "kelly包", "评测", "奢侈品"],
        },
        engagement: {
          likes: 1543,
          saves: 467,
          comments: 128,
          isLiked: true,
          isSaved: true,
        },
        timestamp: "3小时前",
        rating: 5,
      },
      {
        id: "fav-post-3",
        type: "outfit",
        author: {
          id: "user-7",
          name: "Style Maven",
          avatar: "https://via.placeholder.com/60x60",
          isVerified: false,
        },
        content: {
          title: "Saint Laurent踝靴打造秋冬造型",
          description:
            "分享几套以YSL踝靴为重点的秋冬搭配，展现摇滚与优雅并存的风格。这双靴子真的是投资级单品，怎么搭都很有型。",
          images: [
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
          ],
          tags: ["saint laurent", "踝靴", "秋冬", "摇滚风"],
        },
        engagement: {
          likes: 678,
          saves: 189,
          comments: 45,
          isLiked: true,
          isSaved: true,
        },
        timestamp: "6小时前",
        items: [
          {
            id: "fav-item-4",
            name: "Wyatt踝靴",
            brand: "SAINT LAURENT",
            price: "¥9,800",
            imageUrl: "https://via.placeholder.com/150x200",
          },
          {
            id: "fav-item-5",
            name: "皮革外套",
            brand: "SAINT LAURENT",
            price: "¥24,600",
            imageUrl: "https://via.placeholder.com/150x200",
          },
          {
            id: "fav-item-6",
            name: "紧身牛仔裤",
            brand: "SAINT LAURENT",
            price: "¥4,200",
            imageUrl: "https://via.placeholder.com/150x200",
          },
        ],
      },
      {
        id: "fav-post-4",
        type: "article",
        author: {
          id: "editor-3",
          name: "Luxury Editor",
          avatar: "https://via.placeholder.com/60x60",
          isVerified: true,
        },
        content: {
          title: "2024年值得投资的经典包包",
          description:
            "盘点本年度最值得投资的经典包包，从保值性、实用性和时尚度三个维度分析。这些包包不仅是配饰，更是投资品。",
          images: ["https://via.placeholder.com/400x300"],
          tags: ["投资", "包包", "经典", "保值"],
        },
        engagement: {
          likes: 2156,
          saves: 789,
          comments: 234,
          isLiked: false,
          isSaved: true,
        },
        timestamp: "1天前",
        readTime: "6分钟阅读",
      },
      {
        id: "fav-post-5",
        type: "lookbook",
        author: {
          id: "designer-3",
          name: "Gabriela Hearst",
          avatar: "https://via.placeholder.com/60x60",
          isVerified: true,
        },
        content: {
          title: "可持续时尚系列",
          description:
            "展示我们最新的可持续时尚系列，使用环保材料制作的优雅单品。时尚与环保的完美结合，为地球负责的美丽选择。",
          images: [
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
          ],
          tags: ["可持续", "环保", "时尚", "责任"],
        },
        engagement: {
          likes: 1789,
          saves: 445,
          comments: 156,
          isLiked: true,
          isSaved: false,
        },
        timestamp: "2天前",
        brandName: "GABRIELA HEARST",
        season: "Fall/Winter 2024",
      },
      {
        id: "fav-post-6",
        type: "review",
        author: {
          id: "user-8",
          name: "Luxury Lover",
          avatar: "https://via.placeholder.com/60x60",
          isVerified: false,
        },
        content: {
          title: "Bottega Veneta编织包使用感受",
          description:
            "入手BV的Arco包已经8个月了，分享真实的使用体验。从日常搭配到保养心得，全面解析这个网红包包的优缺点。",
          images: [
            "https://via.placeholder.com/400x300",
            "https://via.placeholder.com/400x300",
          ],
          tags: ["bottega veneta", "编织包", "使用体验", "奢侈品"],
        },
        engagement: {
          likes: 456,
          saves: 123,
          comments: 34,
          isLiked: false,
          isSaved: true,
        },
        timestamp: "3天前",
        rating: 4,
      },
    ];
  } catch (error) {
    console.error("Error creating mock favorite posts:", error);
    return [];
  }
};

export const mockFavoritePosts: Post[] = createMockFavoritePosts();
