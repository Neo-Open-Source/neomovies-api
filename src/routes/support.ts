import { Elysia } from "elysia"
import { success } from "../lib/response"

const supporters = [
  { id: 1, name: "Sophron Ragozin", type: ["service"], description: "Покупка и продления основного домена neowatch.ru", contributions: ["Домен neowatch.ru"], year: 2025, isActive: false },
  { id: 2, name: "Chernuha", type: ["code"], description: "Помощь с iOS версией", contributions: ["iOS разработка"], year: 2025, isActive: true },
  { id: 3, name: "Iwnuply", type: ["code"], description: "Создание докер контейнера для API и Frontend", contributions: ["Docker"], year: 2025, isActive: false },
]

export const supportRoutes = new Elysia()
  .get("/api/v1/support/list", () => success(supporters))
