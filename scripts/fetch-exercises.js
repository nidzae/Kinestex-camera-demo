async function fetchAllExercises() {
  const API_KEY = 'rsUhdEkkxOdiR0rmTdpEYEyDzH9Xpjiq';
  const COMPANY = 'BBELabs';
  let allExercises = [];
  let lastDocId = null;
  let page = 1;

  while (true) {
    const url = lastDocId
      ? `https://admin.kinestex.com/api/v1/exercises?limit=50&lastDocId=${lastDocId}`
      : 'https://admin.kinestex.com/api/v1/exercises?limit=50';

    console.error(`Fetching page ${page}...`);

    const response = await fetch(url, {
      headers: {
        'x-api-key': API_KEY,
        'x-company-name': COMPANY
      }
    });

    const data = await response.json();

    if (!data.exercises || data.exercises.length === 0) {
      break;
    }

    allExercises = allExercises.concat(data.exercises);
    lastDocId = data.lastDocId;
    page++;

    if (!lastDocId) break;
  }

  console.error(`Total exercises fetched: ${allExercises.length}`);
  console.log(JSON.stringify({ exercises: allExercises, totalCount: allExercises.length }, null, 2));
}

fetchAllExercises();
