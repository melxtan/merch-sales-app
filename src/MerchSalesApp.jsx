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
  const [userId, setUserId] = useState(null);
  const [authMode, setAuthMode] = useState("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const fetchUserAndData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      fetchInventory(user.id);
      fetchSalesHistory(user.id);
    };
    fetchUserAndData();
  }, []);

  const handleAuth = async () => {
    if (authMode === "sign-up") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert("Sign up failed: " + error.message);
      else alert("Sign up successful. Check your email.");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert("Sign in failed: " + error.message);
      else {
        setUserId(data.user.id);
        fetchInventory(data.user.id);
        fetchSalesHistory(data.user.id);
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserId(null);
    setInventory(null);
    setCart({});
    setSalesHistory([]);
  };

  const fetchInventory = async (uid) => {
    const { data, error } = await supabase.from("inventory").select("*").eq("user_id", uid);
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
  
  const fetchSalesHistory = async (uid) => {
    const { data, error } = await supabase
      .from("sales_history")
      .select("*")
      .eq("user_id", uid)
      .order("timestamp", { ascending: false });
    if (!error) {
      setSalesHistory(data);
    } else {
      console.error("Error fetching sales history:", error);
    }
  };
  
  const handleUpdateItem = (item, field, value) => {
    if (field === "quantity" && /^\d*$/.test(value)) {
      setEditedQuantities((prev) => ({ ...prev, [item]: value }));
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
  
  const toggleEditable = async (item) => {
    const isEditing = editableQuantities[item];
    if (isEditing && editedQuantities[item] !== undefined) {
      const newQty = Number(editedQuantities[item]);
      setInventory((prev) => ({
        ...prev,
        [item]: {
          ...prev[item],
          quantity: newQty,
        },
      }));
      await supabase.from("inventory").update({ quantity: newQty }).eq("item", item).eq("user_id", userId);
    }
    setEditableQuantities((prev) => ({ ...prev, [item]: !prev[item] }));
  };
  
  const handleAddToCart = (item, qty) => {
    if (qty === "" || (typeof qty === "number" && qty >= 0)) {
      setCart((prev) => ({
        ...prev,
        [item]: qty === "" ? undefined : qty,
      }));
    }
  };
  
  const handleRemoveItem = async (item) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${item}"?`);
    if (!confirmed) return;
    await supabase.from("inventory").delete().eq("item", item).eq("user_id", userId);
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
  };
  
  const handleAddNewItem = async () => {
    const { name, price, quantity } = newItem;
    if (!name || !price || !quantity || !userId) return;
    const { error } = await supabase.from("inventory").insert({
      item: name,
      price: Number(price),
      quantity: Number(quantity),
      user_id: userId,
    });
    if (error) {
      console.error("Error inserting item:", error);
      alert("Failed to add item. Check console.");
    } else {
      await fetchInventory(userId);
    }
    setNewItem({ name: "", price: "", quantity: "" });
  };
  
  const calculateTotal = () => {
    return Object.entries(cart).reduce((sum, [item, qty]) => sum + inventory[item].price * qty, 0);
  };
  
  const handleCompleteSale = async () => {
    const saleRecord = [];
    for (const [item, qty] of Object.entries(cart)) {
      const updatedQty = inventory[item].quantity - qty;
      await supabase.from("inventory").update({ quantity: updatedQty }).eq("item", item).eq("user_id", userId);
      saleRecord.push({ item, qty, price: inventory[item].price, total: inventory[item].price * qty });
    }
    const timestamp = new Date().toISOString();
    for (const record of saleRecord) {
      await supabase.from("sales_history").insert({ ...record, timestamp, user_id: userId });
    }
    await fetchInventory(userId);
    await fetchSalesHistory(userId);
    setCart({});
    alert("Sale completed!");
  };
  
  const handleClearCart = () => setCart({});
  
  const handleExportCSV = async () => {
    const { data, error } = await supabase.from("sales_history").select("*").eq("user_id", userId).order("timestamp", { ascending: true });
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
    const { error } = await supabase.from("sales_history").delete().eq("user_id", userId);
    if (error) {
      console.error("Failed to clear sales history:", error);
      alert("Error clearing sales history. Check console.");
    } else {
      await fetchSalesHistory(userId);
      alert("Sales history cleared.");
    }
  };  

  if (!userId) {
    return (
      <div className="max-w-sm mx-auto p-4 space-y-4">
        <h1 className="text-xl font-bold">Sign {authMode === "sign-up" ? "Up" : "In"}</h1>
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button onClick={handleAuth}>
          {authMode === "sign-up" ? "Sign Up" : "Sign In"}
        </Button>
        <p className="text-sm">
          {authMode === "sign-up" ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            className="text-blue-500 underline"
            onClick={() =>
              setAuthMode(authMode === "sign-up" ? "sign-in" : "sign-up")
            }
          >
            {authMode === "sign-up" ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    );
  }
  
  if (!inventory) return <div>Loading...</div>;
  
  return (
    <div className="p-2 space-y-4 w-screen h-screen overflow-y-auto">
      <div className="flex justify-end">
        <Button className="bg-gray-300 text-black" onClick={handleSignOut}>
          Log Out
        </Button>
      </div>
  
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
                    value={
                      editableQuantities[item]
                        ? editedQuantities[item] ?? ""
                        : quantity
                    }
                    disabled={!editableQuantities[item]}
                    onChange={(e) =>
                      handleUpdateItem(item, "quantity", e.target.value)
                    }
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
        {/* Add New Item */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <h2 className="text-lg font-bold">Add New Item</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                placeholder="Item Name"
                value={newItem.name}
                onChange={(e) =>
                  setNewItem({ ...newItem, name: e.target.value })
                }
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
  
        {/* Cart */}
        <Card className="col-span-2">
          <CardContent className="p-3 space-y-2">
            <h2 className="text-lg font-bold">Cart</h2>
            {Object.entries(cart).length === 0 ? (
              <div>No items in cart.</div>
            ) : (
              <ul className="space-y-1">
                {Object.entries(cart).map(([item, qty]) => (
                  <li key={item}>
                    {item}: {qty} x ¥{inventory[item].price} = ¥
                    {qty * inventory[item].price}
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
              <Button
                className="bg-red-600 text-white ml-auto"
                onClick={handleClearSalesHistory}
              >
                Clear Sales History
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  ); 

}