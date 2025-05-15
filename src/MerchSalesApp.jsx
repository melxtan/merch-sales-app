import React, { useState } from "react";
import Card, { CardContent } from "./components/ui/Card";
import Button from "./components/ui/Button";
import Input from "./components/ui/Input";
import Label from "./components/ui/Label";

const initialInventory = {
  "T-Shirt S": { price: 165, quantity: 10 },
  "T-Shirt M": { price: 165, quantity: 10 },
  "T-Shirt L": { price: 165, quantity: 10 },
  "T-Shirt XL": { price: 165, quantity: 10 },
  "T-Shirt XXL": { price: 165, quantity: 10 },
  "Tote Bag Black": { price: 80, quantity: 10 },
  "Tote Bag Green": { price: 80, quantity: 10 },
  "Small Bag Green": { price: 60, quantity: 10 },
  "Small Bag Blue": { price: 60, quantity: 10 },
  "Small Bag Yellow": { price: 60, quantity: 10 },
  "CD 涉吼": { price: 100, quantity: 10 },
  "CD 樱座": { price: 100, quantity: 10 }
};

export default function MerchSalesApp() {
  const [inventory, setInventory] = useState(initialInventory);
  const [cart, setCart] = useState({});
  const [salesHistory, setSalesHistory] = useState([]);
  const [newItem, setNewItem] = useState({ name: "", price: "", quantity: "" });
  const [editableQuantities, setEditableQuantities] = useState({});

  const handleAddToCart = (item, qty) => {
    if (qty === "" || (typeof qty === "number" && qty >= 0)) {
      setCart((prev) => ({
        ...prev,
        [item]: qty === "" ? undefined : qty,
      }));
    }
  };

  const calculateTotal = () => {
    return Object.entries(cart).reduce(
      (sum, [item, qty]) => sum + inventory[item].price * qty,
      0
    );
  };

  const handleCompleteSale = () => {
    const newInventory = { ...inventory };
    const saleRecord = [];

    for (const [item, qty] of Object.entries(cart)) {
      newInventory[item].quantity -= qty;
      saleRecord.push({ item, qty, price: inventory[item].price });
    }

    setInventory(newInventory);
    setSalesHistory((prev) => [
      ...prev,
      {
        sale: saleRecord,
        total: calculateTotal(),
        timestamp: new Date().toISOString(),
      },
    ]);
    setCart({});
    alert("Sale completed!");
  };

  const handleExportCSV = () => {
    const rows = ["Item,Quantity,Price,Total"];
    salesHistory.forEach((record) => {
      record.sale.forEach(({ item, qty, price }) => {
        rows.push(`${item},${qty},${price},${qty * price}`);
      });
    });
    const csvContent = rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "sales-history.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdateItem = (item, field, value) => {
    if (field === "quantity" && /^\d*$/.test(value)) {
      setInventory((prev) => ({
        ...prev,
        [item]: {
          ...prev[item],
          quantity: Number(value),
        },
      }));
    } else if (field === "price" && /^\d*\.?\d*$/.test(value)) {
      setInventory((prev) => ({
        ...prev,
        [item]: {
          ...prev[item],
          price: Number(value),
        },
      }));
    }
  };

  const handleAddNewItem = () => {
    const { name, price, quantity } = newItem;
    if (!name || !price || !quantity) return;

    setInventory((prev) => ({
      ...prev,
      [name]: {
        price: Number(price),
        quantity: Number(quantity),
      },
    }));

    setNewItem({ name: "", price: "", quantity: "" });
  };

  const handleClearCart = () => setCart({});

  const handleRemoveItem = (item) => {
    if (window.confirm(`Are you sure you want to delete "${item}"?`)) {
      setInventory((prev) => {
        const newInventory = { ...prev };
        delete newInventory[item];
        return newInventory;
      });

      setCart((prev) => {
        const newCart = { ...prev };
        delete newCart[item];
        return newCart;
      });

      setEditableQuantities((prev) => {
        const updated = { ...prev };
        delete updated[item];
        return updated;
      });
    }
  };

  const toggleEditable = (item) => {
    setEditableQuantities((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));
  };

  return (
    <div className="p-2 space-y-4 w-screen h-screen overflow-y-auto">
      <h1 className="text-xl font-bold">Merchandise Sales App</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {Object.entries(inventory).map(([item, { price, quantity }]) => (
          <Card key={item}>
            <CardContent className="p-2 space-y-1 text-sm">
              <div className="font-semibold truncate">{item}</div>
              <div className="flex flex-col gap-1">
                <Label>Price:</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  pattern="\d*"
                  value={price}
                  onChange={(e) => handleUpdateItem(item, "price", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Available:</Label>
                <div className="flex gap-2 items-center">
                  <input
                    className="border rounded px-2 py-1 w-full"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={quantity}
                    disabled={!editableQuantities[item]}
                    onChange={(e) => handleUpdateItem(item, "quantity", e.target.value)}
                  />
                  <Button onClick={() => toggleEditable(item)}>
                    {editableQuantities[item] ? "Lock" : "Edit"}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Qty"
                  value={cart[item] !== undefined ? cart[item] : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      handleAddToCart(item, "");
                      return;
                    }
                    if (/^\d+$/.test(val)) {
                      handleAddToCart(item, parseInt(val, 10));
                    }
                  }}
                />
              </div>
              <Button
                className="bg-red-500 text-white w-full mt-2"
                onClick={() => handleRemoveItem(item)}
              >
                Delete Item
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 text-sm">
        <Card>
          <CardContent className="p-3 space-y-2">
            <h2 className="text-lg font-bold">Add New Item</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                placeholder="Item Name"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              />
              <Input
                type="text"
                inputMode="decimal"
                pattern="\d*"
                placeholder="Price"
                value={newItem.price}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^\d*\.?\d*$/.test(val)) {
                    setNewItem({ ...newItem, price: val });
                  }
                }}
              />
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Quantity"
                value={newItem.quantity}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^\d*$/.test(val)) {
                    setNewItem({ ...newItem, quantity: val });
                  }
                }}
              />
            </div>
            <Button onClick={handleAddNewItem}>Add Item</Button>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardContent className="p-3 space-y-2">
            <h2 className="text-lg font-bold">Cart</h2>
            {Object.entries(cart).length === 0 ? (
              <div>No items in cart.</div>
            ) : (
              <ul className="space-y-1">
                {Object.entries(cart).map(([item, qty]) => (
                  <li key={item}>
                    {item}: {qty} x ¥{inventory[item].price} = ¥{qty * inventory[item].price}
                  </li>
                ))}
              </ul>
            )}
            <div className="font-semibold">Total: ¥{calculateTotal()}</div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCompleteSale} disabled={Object.keys(cart).length === 0}>
                Complete Sale
              </Button>
              <Button onClick={handleClearCart}>Clear Cart</Button>
              <Button onClick={handleExportCSV} disabled={salesHistory.length === 0}>
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
