import SearchPage from "./SearchPage";
import { useParams } from "react-router-dom";

export default function Booking({ selection = false }: { selection?: boolean }) {
  const { lotId } = useParams();
  return <SearchPage key={selection ? `selection-${lotId}` : "search"} selection={selection} />;
}
