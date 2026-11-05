export const SITE = {
  name: "YG's Blog",
  shortName: "YG",
  description: "代码、生活与长期主义。记录技术，也记录日子。",
  author: "YG",
  email: "378776683@qq.com",
  github: "https://github.com/liyang52520",
  since: 2025,
};

export type PostType = "posts" | "drafts";

export interface TocItem {
  depth: number;
  text: string;
  id: string;
}

export interface PostMeta {
  slug: string;
  title: string;
  dateRaw: string;
  dateIso: string;
  displayDate: string;
  displayDateTime: string;
  tags: string[];
  categories: string[];
  excerpt: string;
  cover: string;
  readingTime: number;
  type: PostType;
}

export interface Post extends PostMeta {
  body: string;
  html: string;
  toc: TocItem[];
}
