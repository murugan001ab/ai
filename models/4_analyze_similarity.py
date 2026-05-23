import os
import pickle
import numpy as np
from itertools import combinations

# =========================================================
# CONFIG
# =========================================================

EMBEDDINGS_DIR = "embeddings"

MEMBERS = [
    "Malavika",
    "Selva",
    "Madhavan",
    "Nidheesh",
    "Ram",
]

# =========================================================
# LOAD EMBEDDINGS
# =========================================================

people = {}

for name in MEMBERS:

    path = os.path.join(
        EMBEDDINGS_DIR,
        f"{name.lower()}.pkl"
    )

    with open(path, "rb") as f:

        data = pickle.load(f)

    embeddings = data["embeddings"]

    embeddings = [

        e / np.linalg.norm(e)

        for e in embeddings
    ]

    people[name] = embeddings

    print(
        f"{name} → "
        f"{len(embeddings)} embeddings loaded"
    )

# =========================================================
# SAME PERSON SIMILARITY
# =========================================================

print("\n" + "="*60)
print("SAME PERSON SIMILARITY")
print("="*60)

same_scores_all = []

for name, embeddings in people.items():

    scores = []

    # compare every pair
    for a, b in combinations(embeddings, 2):

        sim = np.dot(a, b)

        scores.append(sim)

    scores = np.array(scores)

    same_scores_all.extend(scores)

    print(f"\n{name}")

    print(f"Min  : {scores.min():.4f}")
    print(f"Max  : {scores.max():.4f}")
    print(f"Mean : {scores.mean():.4f}")
    print(f"Std  : {scores.std():.4f}")

# =========================================================
# DIFFERENT PERSON SIMILARITY
# =========================================================

print("\n" + "="*60)
print("DIFFERENT PERSON SIMILARITY")
print("="*60)

diff_scores_all = []

for i in range(len(MEMBERS)):

    for j in range(i + 1, len(MEMBERS)):

        name1 = MEMBERS[i]
        name2 = MEMBERS[j]

        emb1 = people[name1]
        emb2 = people[name2]

        scores = []

        for e1 in emb1:

            for e2 in emb2:

                sim = np.dot(e1, e2)

                scores.append(sim)

        scores = np.array(scores)

        diff_scores_all.extend(scores)

        print(f"\n{name1}  vs  {name2}")

        print(f"Min  : {scores.min():.4f}")
        print(f"Max  : {scores.max():.4f}")
        print(f"Mean : {scores.mean():.4f}")
        print(f"Std  : {scores.std():.4f}")

# =========================================================
# GLOBAL STATS
# =========================================================

same_scores_all = np.array(same_scores_all)

diff_scores_all = np.array(diff_scores_all)

print("\n" + "="*60)
print("GLOBAL SUMMARY")
print("="*60)

print("\nSAME PERSON")

print(f"Min  : {same_scores_all.min():.4f}")
print(f"Max  : {same_scores_all.max():.4f}")
print(f"Mean : {same_scores_all.mean():.4f}")

print("\nDIFFERENT PERSON")

print(f"Min  : {diff_scores_all.min():.4f}")
print(f"Max  : {diff_scores_all.max():.4f}")
print(f"Mean : {diff_scores_all.mean():.4f}")

# =========================================================
# THRESHOLD SUGGESTION
# =========================================================

recommended = (
    diff_scores_all.max() +
    same_scores_all.min()
) / 2

print("\n" + "="*60)

print(
    f"Suggested Threshold: "
    f"{recommended:.4f}"
)

print("="*60)