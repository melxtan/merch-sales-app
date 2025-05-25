import React, { useEffect, useState } from "react";
import Card, { CardContent } from "./components/ui/Card";
import Button from "./components/ui/Button";
import Input from "./components/ui/Input";
import Label from "./components/ui/Label";
import { supabase } from "./supabaseClient";

export default function MerchSalesApp() {
  const [inventory, setInventory] = useState(null);
  const [cart, setCart] = useState({});
  const [salesHistory, setSalesHistory] = useState([]);
  const [newItem, setNewItem] = useState({ name: "", price: "", quantity: "" });
  const [editableQuantities, setEditableQuantities] = useState({});
  const [editedQuantities, setEditedQuantities] = useState({});

  const fetchInventory = async () => {
    const { data, error } = await supabase.from("inventory").select("*");
    if (!error) {
      const formatted = {};
      data.forEach(({ item, price, quantity }) => {
        formatted[item] = { price, quantity };
      });
      setInventory(formatted);
    } else {
      console.error("Error fetching inventory:", error);
    }
  };

  const fetchSalesHistory = async () => {
    const { data, error } = await supabase.from("sales_history").select("*").order("timestamp", { ascending: false });
    if (!error) {
      setSalesHistory(data);
    } else {
      console.error("Error fetching sales history:", error);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchSalesHistory();
  }, []);

  const handleAddNewItem = async () => {
    const { name, price, quantity } = newItem;
    if (!name || !price || !quantity) return;

    const { data, error } = await supabase.from("inventory").insert({
      item: name,
      price: Number(price),
      quantity: Number(quantity)
    });

    if (error) {
      console.error("Error inserting item:", error);
      alert("Failed to add item. Check console.");
    } else {
      console.log("Item inserted:", data);
      await fetchInventory();
    }

    setNewItem({ name: "", price: "", quantity: "" });
  };

  const handleAddToCart = (item, qty) => {
    if (qty === "" || (typeof qty === "number" && qty >= 0)) {
      setCart((prev) => ({
        ...prev,
        [item]: qty === "" ? undefined : qty,
      }));
    }
  };

  const calculateTotal = () => {
    return Object.entries(cart).reduce((sum, [item, qty]) => sum + inventory[item].price * qty, 0);
  };

  const handleCompleteSale = async () => {
    const saleRecord = [];
    for (const [item, qty] of Object.entries(cart)) {
      const updatedQty = inventory[item].quantity - qty;
      await supabase.from("inventory").update({ quantity: updatedQty }).eq("item", item);
      saleRecord.push({ item, qty, price: inventory[item].price, total: inventory[item].price * qty });
    }

    const timestamp = new Date().toISOString();
    for (const record of saleRecord) {
      await supabase.from("sales_history").insert({ ...record, timestamp });
    }

    await fetchInventory();
    await fetchSalesHistory();
    setCart({});
    alert("Sale completed!");
  };

  const handleExportCSV = async () => {
    const { data, error } = await supabase.from("sales_history").select("*").order("timestamp", { ascending: true });
    if (error) {
      console.error("Error exporting sales history:", error);
      alert("Failed to export CSV. Check console.");
      return;
    }

    const rows = ["Item,Quantity,Price,Total,Timestamp"];
    data.forEach(({ item, qty, price, total, timestamp }) => {
      rows.push(`${item},${qty},${price},${total},${timestamp}`);
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

  const handleClearSalesHistory = async () => {
    const confirmed = window.confirm("Are you sure you want to delete ALL sales history? This cannot be undone.");
    if (!confirmed) return;

    const { error } = await supabase.from("sales_history").delete().not("id", "is", null);
    if (error) {
      console.error("Failed to clear sales history:", error);
      alert("Error clearing sales history. Check console.");
    } else {
      await fetchSalesHistory();
      alert("Sales history cleared.");
    }
  };

  const handleUpdateItem = (item, field, value) => {
    if ((field === "quantity" && /^\d*$/.test(value)) || (field === "price" && /^\d*\.?\d*$/.test(value))) {
      const updatedValue = Number(value);
      if (field === "quantity") {
        setEditedQuantities((prev) => ({
          ...prev,
          [item]: updatedValue,
        }));
      } else {
        setInventory((prev) => ({
          ...prev,
          [item]: {
            ...prev[item],
            [field]: updatedValue,
          },
        }));
        supabase.from("inventory").update({ [field]: updatedValue }).eq("item", item);
      }
    }
  };

  const toggleEditable = async (item) => {
    const isEditing = editableQuantities[item];
    if (isEditing) {
      const newQty = editedQuantities[item];
      if (newQty !== undefined) {
        await supabase.from("inventory").update({ quantity: newQty }).eq("item", item);
        setInventory((prev) => ({
          ...prev,
          [item]: {
            ...prev[item],
            quantity: newQty,
          },
        }));
      }
    } else {
      setEditedQuantities((prev) => ({
        ...prev,
        [item]: inventory[item].quantity
      }));
    }
    setEditableQuantities((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));
  };

  const handleClearCart = () => setCart({});

  const handleRemoveItem = async (item) => {
    if (window.confirm(`Are you sure you want to delete "${item}"?`)) {
      const { error } = await supabase.from("inventory").delete().eq("item", item);
      if (error) {
        console.error("Failed to delete item:", error);
        alert("Error deleting item. Check console.");
        return;
      }
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

  if (!inventory) return <div>Loading...</div>;

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
                    value={editableQuantities[item] ? (editedQuantities[item] ?? "") : quantity}
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
              <Button className="bg-red-500 text-white w-full mt-2" onClick={() => handleRemoveItem(item)}>
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
              <Button className="bg-red-600 text-white ml-auto" onClick={handleClearSalesHistory}>
                Clear Sales History
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
