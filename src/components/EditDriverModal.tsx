// src/components/EditDriverModal.tsx
import { useState, useEffect } from "react";
import { doc, updateDoc, getFirestore } from "firebase/firestore";
import toast from "react-hot-toast";
import classNames from "classnames";

interface EditDriverModalProps {
  driver: any;
  onClose: () => void;
  onSaveSuccess: () => void;
}

const EditDriverModal = ({ driver, onClose, onSaveSuccess }: EditDriverModalProps) => {
  const db = getFirestore();
  const [visible, setVisible] = useState(false);

  const [form, setForm] = useState({
    name: driver.name || "",
    plate: driver.plate || "",
    status: driver.status || "offline",
    contact: driver.contact || "",
    age: driver.age || "",
    paymentNumber: driver.paymentNumber || "",
  });

  const [loading, setLoading] = useState(false);

  // Trigger animation after mount
  useEffect(() => {
    setTimeout(() => setVisible(true), 10);
  }, []);

  const validateFields = () => {
    const { name, plate, contact, age } = form;

    if (!name || !plate || !contact || !age) {
      toast.error("Please fill in all required fields");
      return false;
    }

    const phoneRegex = /^[0-9]{10,13}$/;
    if (!phoneRegex.test(contact)) {
      toast.error("Enter a valid contact number");
      return false;
    }

    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 100) {
      toast.error("Enter a valid age (18–100)");
      return false;
    }

    return true;
  };

  const handleUpdate = async () => {
    if (!validateFields()) return;

    try {
      setLoading(true);
      await updateDoc(doc(db, "drivers", driver.id), {
        ...form,
        age: parseInt(form.age),
      });
      toast.success("Driver updated");
      onSaveSuccess();
      handleClose();
    } catch (err) {
      console.error(err);
      toast.error("Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(), 250); // match exit animation duration
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div
        className={classNames(
          "bg-gray-900 p-6 rounded-lg max-w-md w-full transform transition-all duration-300",
          {
            "scale-100 opacity-100": visible,
            "scale-95 opacity-0": !visible,
          }
        )}
      >
        <h2 className="text-lg font-bold text-white mb-4">Edit Driver</h2>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full p-2 rounded text-black"
          />
          <input
            type="text"
            placeholder="Plate"
            value={form.plate}
            onChange={(e) => setForm({ ...form, plate: e.target.value })}
            className="w-full p-2 rounded text-black"
          />
          <input
            type="text"
            placeholder="Contact"
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
            className="w-full p-2 rounded text-black"
          />
          <input
            type="number"
            placeholder="Age"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
            className="w-full p-2 rounded text-black"
          />
          <input
            type="text"
            placeholder="Payment Number"
            value={form.paymentNumber}
            onChange={(e) => setForm({ ...form, paymentNumber: e.target.value })}
            className="w-full p-2 rounded text-black"
          />
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full p-2 rounded text-black"
          >
            <option value="offline">Offline</option>
            <option value="online">Online</option>
          </select>
        </div>

        <div className="flex justify-end mt-6 space-x-3">
          <button
            onClick={handleClose}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditDriverModal;
