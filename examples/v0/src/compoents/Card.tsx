const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function Card() {
  await delay(5000);

  return (
    <div className="card">
      <button>count hahahah {123}</button>
      <p>
        <code>src/App.tsx</code>and save to
      </p>
    </div>
  );
}

export default Card;
