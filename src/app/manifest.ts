import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bazar Casual · Gestão financeira",
    short_name: "Bazar Casual",
    description: "Clientes, vendas, despesas, parcelas e cobranças em um só lugar.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff8fb",
    theme_color: "#f4146f",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
