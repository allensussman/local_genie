import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Button, Alert } from 'react-native';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import axios from 'axios';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import { Buffer } from "buffer";


const OPENAI_API_KEY = ''; // Replace with your OpenAI API key
const GEO_API_USERNAME = ''; // Replace with your GeoNames username

export default function App() {
  const [locationInfo, setLocationInfo] = useState(null);
  const [Fact, setFact] = useState(null);
  const [sound, setSound] = useState();
  const [loading, setLoading] = useState(false);

  const downloadAndSaveMP3 = async (factoid) => {
    try {
      setFact(`Converting to audio...\n\n${factoid}`)
      // API endpoint
      const url = "https://api.openai.com/v1/audio/speech";

      // Define headers and data to send with the request
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      };

      const data = {
        model: "tts-1",
        input: `${factoid}`,
        voice: "alloy",
      };

      // Fetch MP3 file with headers and data
      const response = await axios({
        url,
        method: "POST", // or 'GET', depending on your API requirements
        headers: headers,
        data: data,
        responseType: "arraybuffer", // Updated to 'arraybuffer' for binary data
      });

      // Determine a path to save the file
      const uri = `${FileSystem.documentDirectory}downloadedFile.mp3`;

      // Convert the response to Base64
      const base64 = Buffer.from(response.data, "binary").toString("base64");

      // Write the file to the local filesystem
      await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`MP3 file saved to: ${uri}`);

      setFact(`${factoid}\n\nClick to hear more!`)
      // Play the downloaded file
      playSound(uri);
    } catch (error) {
      console.error("Error downloading or saving file:", error);
    }
  };

  const playSound = async (uri) => {
    console.log('Loading Sound');
    const { sound } = await Audio.Sound.createAsync({ uri });
    setSound(sound);

    console.log('Playing Sound');
    await sound.playAsync();
  };

const fetchNearestIntersection = async (latitude, longitude) => {
    setFact('Getting nearest intersection...')
  //  const geoApiUrl = `http://api.geonames.org/findNearestIntersectionJSON?lat=${latitude}&lng=${longitude}&username=alsuss`;   //include works in NYC
    const geoApiUrl = `http://api.geonames.org/findNearestIntersectionOSMJSON?lat=${latitude}&lng=${longitude}&username=alsuss&includeGeoName=true`;
    
      try {
        const response = await fetch(geoApiUrl);
        const data = await response.json();
        if (data) {
          // setLocationInfo(`${data.intersection.street1} and ${data.intersection.street2}`);   //include works in NYC
          // return `${data.intersection.street1} and ${data.intersection.street2}`;   //include works in NYC
          // cityName is like neighoborhood, adminName2 is like county, adminName1 is like state, countryCode is like US
          setLocationInfo(`The intersection of ${data.intersection.street1} and ${data.intersection.street2} in ${data.intersection.cityName}, ${data.intersection.adminName2}, ${data.intersection.adminName1}, ${data.intersection.countryCode}`);
          return `The intersection of ${data.intersection.street1} and ${data.intersection.street2} in ${data.intersection.cityName}, ${data.intersection.adminName2}, ${data.intersection.adminName1}, ${data.intersection.countryCode}`;
        } else {
          setLocationInfo('No nearby streets found');
          return 'No nearby streets found';
        }
      } catch (error) {
        console.error('Error fetching data from GeoNames:', error);
        setLocationInfo('Error fetching intersection data');
        return 'Error fetching intersection data';
      }
    // return `Northside Piers and N 5th St`;
  };

  const getFactAboutIntersection = async (intersection) => {
    setFact('Getting factoids about location...');
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-1106-preview',
          messages: [
            // { "role": "system", "content": "You are a tour guide in new york city.  Your task is to provide in depth, detailed, interesting historical factoids in relation to particular locations in new york city.  The historical factoids for each location should be distinct, but should ideally focus on the same general topic.  Your tone should be very casual, very conversational, and engaging.  You don't need to provide any conclusion.  The user will provide you with a location and you will come up with one historical factoid about that location." },
            { "role": "system", "content": "You are a tour guide.  Your task is to provide in depth, detailed, interesting historical factoids in relation to particular locations.  The historical factoids for each location should be distinct.  Your tone should be very casual, very conversational, and engaging.  You don't need to provide any conclusion.  The user will provide you with a location and you will come up with one historical factoid about that location." },
            { 'role': 'user', 'content': `${intersection}` }
          ],
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (response.data.choices && response.data.choices.length > 0) {
        const text = response.data.choices[0].message.content;
        return text;
      }

    } catch (error) {
      console.error("Error fetching fact:", error);
      setFact('Error fetching fact.');
    }
    // const text = `The Williamsburg Bridge is a suspension bridge in New York City across the East River.`;
    // setFact(text);
    // return text;

  };

  const getLocationIntersectionFactSound = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Permission to access location was denied');
      return;
    }

    try {
      setFact('Getting location...')
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      // const latitude = 35.69538;
      // const longitude = 139.705050;
      const intersection = await fetchNearestIntersection(latitude, longitude);
      const factoid = await getFactAboutIntersection(intersection);
      await downloadAndSaveMP3(factoid);
    } catch (error) {
      Alert.alert('Error', 'Unable to fetch location');
    }
  };

  useEffect(() => {
      return sound
        ? () => {
            console.log('Unloading Sound');
            sound.unloadAsync(); 
          }
        : undefined;
    }, [sound]);

  return (
    <View style={styles.container}>
      <Text>{Fact || ''}</Text>
      <Button title="Tell Me About My Location" onPress={getLocationIntersectionFactSound} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});


  // const speakText = (textToSpeak) => {
  //   Speech.speak(textToSpeak, {
  //     voice: 'com.apple.speech.synthesis.voice.Kathy',
  //     rate: 1,
  //   }
  //   );
  // };

// const playMP3fromarraybuffer = async (mp3Data) => {
//   try {
//     const soundObject = new Audio.Sound();
//     const blob = new Blob([mp3Data], { type: 'audio/mp3' });
//     const url = URL.createObjectURL(blob);
//     await soundObject.loadAsync({ uri: url });
//     await soundObject.playAsync();
//     // Additional sound controls as needed
//   } catch (error) {
//     console.error('Error playing MP3:', error);
//   }
// };
  
// const playMP3fromblob = async (mp3Data) => {
//   try {
//     const soundObject = new Audio.Sound();
//     const url = URL.createObjectURL(mp3Data);
//     await soundObject.loadAsync({ uri: url });
//     await soundObject.playAsync();
//     // Additional sound controls as needed
//   } catch (error) {
//     console.error('Error playing MP3:', error);
//   }
// };
  
// async function playSound(fileUri) {
//   const sound = new Audio.Sound();
//   try {
//     await sound.loadAsync({ uri: fileUri });
//     await sound.playAsync();
//     // Your sound is playing!

//     // Don't forget to unload the sound from memory
//     // when you are done using the Sound object
//     return sound;
//   } catch (error) {
//     // An error occurred!
//   }
// }

// async function writeArrayBufferToFile(arrayBuffer) {
//   const base64String = Buffer.from(arrayBuffer).toString('base64');
//   const fileName = `temp-${new Date().getTime()}.mp3`; // Unique file name
//   const uri = `${FileSystem.documentDirectory}${fileName}`;

//   await FileSystem.writeAsStringAsync(uri, base64String, {
//     encoding: FileSystem.EncodingType.Base64,
//   });

//   return uri;
// }
  
// const fetchSpeech = async () => {
//   try {
//     setLoading(true);

//     const response = await axios.post(
//       'https://api.openai.com/v1/audio/speech',
//       {
//         model: 'tts-1',
//         input: `${Fact}`,
//         voice: 'alloy',
//         response_format: 'mp3',
//       },
//       {
//         headers: {
//           'Authorization': `Bearer ${OPENAI_API_KEY}`,
//           'Content-Type': 'application/json',
//         },
//         responseType: 'blob',
//       },
//     );

//     return response.data;
//   } catch (error) {
//     console.error("Error fetching speech:", error);
//     setFact('Error fetching speech.');
//     return null;
//   } finally {
//     setLoading(false);
//   }
// };
