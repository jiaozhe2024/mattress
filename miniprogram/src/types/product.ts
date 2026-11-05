export interface Product {
  id: number;
  name: string;
  model: string;
  main_image: string;
  spec?: string;
  sleep_feel?: string;
  slogan?: string;
  tags?: string[];
  price?: number;
}