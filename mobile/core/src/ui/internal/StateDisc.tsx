import { View } from "react-native";
import { createStyles } from "../../theme/createStyles";
import { useDesign } from "../../theme/DesignProvider";
import { Icon, type IconName } from "../Icon";

const useStyles = createStyles(({ colors, sizes, radii }) => ({
  disc: {
    width: sizes.stateDisc,
    height: sizes.stateDisc,
    borderRadius: radii.mark,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.sunken,
  },
}));

/** The quiet grey disc behind EmptyState and ErrorState icons. */
export function StateDisc({ icon }: { icon: IconName }) {
  const styles = useStyles();
  const { familyColors } = useDesign();
  return (
    <View style={styles.disc}>
      <Icon name={icon} size="state" color={familyColors.grey.solid} />
    </View>
  );
}
