from pathlib import Path

p = Path(r"d:\aressouz\src\app\components\diller\DillerQarzTab.tsx")
lines = p.read_text(encoding="utf-8").splitlines(True)
start = next(i for i, l in enumerate(lines) if "activeSection === 'statistika'" in l and "analitika" in l)
end = next(i for i, l in enumerate(lines) if "activeSection === 'buyurtma'" in l) - 1
while end > start and lines[end].strip() == "":
    end -= 1
new = [
    "      {activeSection === 'statistika' || activeSection === 'analitika' ? (\n",
    "        <DillerStatistikaSection\n",
    "          mode={activeSection}\n",
    "          data={data}\n",
    "          onGoHome={onGoHome}\n",
    "        />\n",
    "      ) : null}\n",
    "\n",
]
p.write_text("".join(lines[:start] + new + lines[end + 1 :]), encoding="utf-8")
print("replaced", start + 1, "to", end + 1)
