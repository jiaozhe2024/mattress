import { describe, expect, it } from "vitest";
import type { WxProductDetail } from "@/components/product/productDetailModel";
import {
  DETAIL_DISCLAIMER,
  DETAIL_TABS,
  detailImageOf,
  featureLineOf,
  imageListOf,
  modelLineOf,
  parseProductId,
  posterImagesOf,
  productNameOf,
  realImagesOf,
  shareMessageOf,
  specLineOf,
} from "@/components/product/productDetailModel";

function makeDetail(overrides: Partial<WxProductDetail> = {}): WxProductDetail {
  return {
    id: 1,
    category_id: 1,
    category_name: "6S专属床垫",
    name: "卷绵薄垫万能款",
    model: "JM-BD-06",
    slogan: "6cm 薄垫 · 轻盈舒适",
    spec: "1800 × 2000 mm",
    sleep_feel: "细腻面料　｜　分层支撑　｜　简洁设计",
    main_image: "/uploads/demo/product-3d-main.jpg",
    sort: 1,
    detail_images: [
      "/uploads/demo/product-3d-detail-1.jpg",
      "/uploads/demo/product-3d-detail-2.jpg",
    ],
    real_images: ["/uploads/demo/product-3d-real-1.jpg"],
    detail_content: "<p>六大专属，分龄深睡</p>",
    create_time: null,
    ...overrides,
  };
}

describe("productDetailModel：query 解析（spec §5.4 / tasks MP-04 ⑩）", () => {
  it("接受正整数字符串与数字", () => {
    expect(parseProductId("12")).toBe(12);
    expect(parseProductId(7)).toBe(7);
  });

  it("缺参 / 空串 / 0 / 负数 / 小数 / 非数字 → null（错误态）", () => {
    expect(parseProductId(undefined)).toBeNull();
    expect(parseProductId(null)).toBeNull();
    expect(parseProductId("")).toBeNull();
    expect(parseProductId("0")).toBeNull();
    expect(parseProductId("-3")).toBeNull();
    expect(parseProductId("1.5")).toBeNull();
    expect(parseProductId("abc")).toBeNull();
  });
});

describe("productDetailModel：图片列表收敛", () => {
  it("只保留非空字符串，过滤 null / 数字 / 空串", () => {
    expect(imageListOf(["/a.jpg", null, 3, "", "  ", "/b.jpg"])).toEqual([
      "/a.jpg",
      "/b.jpg",
    ]);
  });

  it("非数组（null / 字符串）→ 空数组", () => {
    expect(imageListOf(null)).toEqual([]);
    expect(imageListOf("/a.jpg")).toEqual([]);
  });

  it("海报图集优先 detail_images；为空回退主图", () => {
    expect(posterImagesOf(makeDetail())).toHaveLength(2);
    expect(posterImagesOf(makeDetail({ detail_images: [] }))).toEqual([
      "/uploads/demo/product-3d-main.jpg",
    ]);
    expect(posterImagesOf(makeDetail({ detail_images: null }))).toEqual([
      "/uploads/demo/product-3d-main.jpg",
    ]);
  });

  it("详情细节图取图集首张", () => {
    expect(detailImageOf(makeDetail())).toBe(
      "/uploads/demo/product-3d-detail-1.jpg"
    );
  });

  it("实拍图取 real_images", () => {
    expect(realImagesOf(makeDetail())).toEqual([
      "/uploads/demo/product-3d-real-1.jpg",
    ]);
    expect(realImagesOf(makeDetail({ real_images: null }))).toEqual([]);
  });
});

describe("productDetailModel：文案（spec §5.4 逐字）", () => {
  it("规格行 = 规格：{spec} · 实际配置以产品说明为准", () => {
    expect(specLineOf(makeDetail())).toBe(
      "规格：1800 × 2000 mm · 实际配置以产品说明为准"
    );
  });

  it("规格缺失 → 规格：— · 实际配置以产品说明为准", () => {
    expect(specLineOf(makeDetail({ spec: null }))).toBe(
      "规格：— · 实际配置以产品说明为准"
    );
  });

  it("型号行 = 型号：{model}", () => {
    expect(modelLineOf(makeDetail())).toBe("型号：JM-BD-06");
    expect(modelLineOf(makeDetail({ model: "" }))).toBe("型号：—");
  });

  it("feature 行取睡感，空则空串（不渲染）", () => {
    expect(featureLineOf(makeDetail())).toBe("细腻面料　｜　分层支撑　｜　简洁设计");
    expect(featureLineOf(makeDetail({ sleep_feel: null }))).toBe("");
  });

  it("产品名去首尾空白", () => {
    expect(productNameOf(makeDetail({ name: "  卷绵薄垫  " }))).toBe("卷绵薄垫");
    expect(productNameOf(makeDetail())).toBe("卷绵薄垫万能款");
  });

  it("免责文案与详情 Tab 文案固定", () => {
    expect(DETAIL_DISCLAIMER).toBe("尺寸、厚度与具体材质请以产品实物及说明为准。");
    expect(DETAIL_TABS.map((tab) => tab.label)).toEqual(["产品详情", "实拍图"]);
  });
});

describe("productDetailModel：分享载荷（⑦ onShareAppMessage）", () => {
  it("标题=产品名，路径带 id，封面=主图", () => {
    expect(shareMessageOf(makeDetail())).toEqual({
      title: "卷绵薄垫万能款",
      path: "/pages/product/detail?id=1",
      imageUrl: "/uploads/demo/product-3d-main.jpg",
    });
  });

  it("主图为空时不带 imageUrl", () => {
    const message = shareMessageOf(makeDetail({ main_image: "" }));
    expect(message.imageUrl).toBeUndefined();
  });
});
