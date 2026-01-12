import React from "react";
import { View, Image } from "react-native";
import { styles } from "../styles";

export const BrandLogo: React.FC = () => {
  return (
    <View style={styles.brandContainer}>
      <Image
        source={require("../../../../assets/images/logo.jpg")}
        style={styles.logoImage}
        resizeMode="contain"
      />
    </View>
  );
};
