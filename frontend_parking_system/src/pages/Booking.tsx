import SearchPage from "./SearchPage";
import { useParams, useSearchParams } from "react-router-dom";

export default function Booking({ selection = false }: { selection?: boolean }) {
  const { lotId } = useParams();
  const [params] = useSearchParams();
  const preview = import.meta.env.DEV && params.get("preview") === "1";
  return <SearchPage key={`${selection ? `selection-${lotId}` : "search"}-${preview}`} selection={selection} />;
}
