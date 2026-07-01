import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SelectionBar } from "./SelectionBar";

function setup(overrides = {}) {
  const props = {
    count: 3,
    collections: [{ id: "c1", name: "여름" }],
    onAddToCollection: vi.fn(),
    onCreateAndAdd: vi.fn(),
    onFavorite: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  render(<SelectionBar {...props} />);
  return props;
}

describe("SelectionBar", () => {
  it("shows the selected count", () => {
    setup({ count: 5 });
    expect(screen.getByText("5개 선택")).toBeInTheDocument();
  });

  it("favorites the selection", () => {
    const { onFavorite } = setup();
    fireEvent.click(screen.getByRole("button", { name: /즐겨찾기/ }));
    expect(onFavorite).toHaveBeenCalled();
  });

  it("deletes the selection", () => {
    const { onDelete } = setup();
    fireEvent.click(screen.getByRole("button", { name: /삭제/ }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("adds the selection to an existing collection", () => {
    const { onAddToCollection } = setup();
    fireEvent.click(screen.getByRole("button", { name: /컬렉션에 추가/ }));
    fireEvent.click(screen.getByText("여름"));
    expect(onAddToCollection).toHaveBeenCalledWith("c1");
  });

  it("creates a new collection and adds the selection", () => {
    const { onCreateAndAdd } = setup();
    fireEvent.click(screen.getByRole("button", { name: /컬렉션에 추가/ }));
    fireEvent.click(screen.getByText("새 컬렉션에 추가"));
    const input = screen.getByPlaceholderText("새 컬렉션 이름");
    fireEvent.change(input, { target: { value: "가을" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCreateAndAdd).toHaveBeenCalledWith("가을");
  });

  it("clears the selection", () => {
    const { onClear } = setup();
    fireEvent.click(screen.getByTitle("선택 해제 (Esc)"));
    expect(onClear).toHaveBeenCalled();
  });
});
