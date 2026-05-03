import { Search } from "lucide-react";

export function SearchBar({
  name = "q",
  placeholder = "Cari data",
  defaultValue,
}: {
  name?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="search-box">
      <Search size={16} />
      <input name={name} placeholder={placeholder} defaultValue={defaultValue} />
    </label>
  );
}
