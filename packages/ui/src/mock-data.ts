export type Family = {
  id: string;
  code: string; // e.g. "1"
  name: string; // e.g. "Entretelas"
  color?: string; // Optional color for the family card
};

export type Product = {
  id: string;
  familyId: string;
  code: string; // e.g. "1.1"
  name: string; // e.g. "Entretela Duecotex"
  stock: number;
  price: number; // Base price
  description: string;
  category: string;
  color: string;
};

export const families: Family[] = [
  { id: "f1", code: "1", name: "Entretelas", color: "bg-blue-500/10 border-blue-500/20 text-blue-500" },
  { id: "f2", code: "2", name: "Popelina", color: "bg-purple-500/10 border-purple-500/20 text-purple-500" },
  { id: "f7", code: "7", name: "Raso", color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" },
  { id: "f8", code: "8", name: "Tafeta", color: "bg-amber-500/10 border-amber-500/20 text-amber-500" },
  { id: "f9", code: "9", name: "Zermat", color: "bg-rose-500/10 border-rose-500/20 text-rose-500" },
];

export const products: Product[] = [
  // Fam 1: Entretelas
  { id: "p1-1", familyId: "f1", code: "1.1", name: "ENTRETELA DUECOTEX", stock: 1500, price: 4.50, description: "Entretela fusionable de alta calidad", category: "Entretelas", color: "Blanco" },
  { id: "p1-2", familyId: "f1", code: "1.2", name: "ENTRETELA ADHESIVA", stock: 800, price: 5.20, description: "Adhesivo fuerte de una cara", category: "Entretelas", color: "Gris" },
  { id: "p1-3", familyId: "f1", code: "1.3", name: "ENTRETELA TRICOTEX", stock: 2100, price: 3.80, description: "Entretela tejida ligera", category: "Entretelas", color: "Negro" },
  { id: "p1-4", familyId: "f1", code: "1.4", name: "PELÓN ADHESIVO", stock: 500, price: 2.50, description: "Pelón para manualidades y refuerzo", category: "Entretelas", color: "Blanco" },
  
  // Fam 2: Popelina
  { id: "p2-1", familyId: "f2", code: "2.1", name: "POPELINA BLANCA", stock: 320, price: 6.00, description: "Popelina 100% algodón fresca", category: "Popelina", color: "Blanco" },
  { id: "p2-2", familyId: "f2", code: "2.2", name: "POPELINA COLOR", stock: 145, price: 6.50, description: "Popelina de color reactivo", category: "Popelina", color: "Azul" },
  
  // Fam 7: Raso
  { id: "p7-1", familyId: "f7", code: "7.1", name: "RASO COLOR", stock: 950, price: 3.50, description: "Raso satinado brilloso", category: "Raso", color: "Rojo" },
  { id: "p7-2", familyId: "f7", code: "7.2", name: "RASO ESTAMPADO", stock: 230, price: 4.20, description: "Raso con estampados elegantes", category: "Raso", color: "Multicolor" },
  { id: "p7-3", familyId: "f7", code: "7.3", name: "RASO NUPCIAL", stock: 110, price: 8.00, description: "Raso grueso para vestidos de novia", category: "Raso", color: "Marfil" },

  // Fam 8: Tafeta
  { id: "p8-1", familyId: "f8", code: "8.1", name: "TAFETA FORRO", stock: 4000, price: 2.10, description: "Tafeta ligera para forro interno", category: "Tafeta", color: "Negro" },
  { id: "p8-2", familyId: "f8", code: "8.2", name: "TAFETA PESADA", stock: 850, price: 3.00, description: "Tafeta gruesa de estructura firme", category: "Tafeta", color: "Azul Marino" },

  // Fam 9: Zermat
  { id: "p9-1", familyId: "f9", code: "9.1", name: "ZERMAT ESCOLAR", stock: 640, price: 9.50, description: "Zermat resistente para uniformes", category: "Zermat", color: "Gris" },
  { id: "p9-2", familyId: "f9", code: "9.2", name: "ZERMAT PREMIUM", stock: 210, price: 12.00, description: "Zermat extra suave y duradero", category: "Zermat", color: "Azul Noche" },
];
