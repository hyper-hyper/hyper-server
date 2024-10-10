// test

const tsx = `const App = () => <div>Yo!</div>`;

const transpiler = new Bun.Transpiler({
  loader:"tsx"
});

console.log(transpiler.transformSync(`App`));
