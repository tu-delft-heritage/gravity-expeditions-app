const importChapters = () => {
  const modules = import.meta.glob("$lib/content/*.md", {
    eager: true,
  });

  const sections = Object.entries(modules).map(([path, mod]) => ({
    slug: path.split("/").pop()?.slice(3).replace(".md", ""),
    Component: mod.default,
    ...mod.metadata,
  }));

  return sections;
};

const chapters = importChapters();

export default chapters;
